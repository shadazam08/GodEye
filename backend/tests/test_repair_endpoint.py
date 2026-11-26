import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

import main
from database import get_db
from security import require_reviewer
from services.photo_validation import (
    MAX_UPLOAD_BYTES,
    PhotoValidationError,
)
from user_auth import CurrentUser, require_verified_user


class RepairEndpointTests(unittest.TestCase):
    def setUp(self):
        self.report_id = uuid4()

        self.report = SimpleNamespace(
            id=self.report_id,
            status="verified",
            repaired_at=None,
        )

        self.admin = CurrentUser(
            uid="test-admin",
            email="admin@example.com",
            email_verified=True,
            name="Test Admin",
        )

        self.db = MagicMock()
        self.db.scalar.side_effect = [self.report, None]

        previous_overrides = (
            main.app.dependency_overrides.copy()
        )

        def restore_overrides():
            main.app.dependency_overrides.clear()
            main.app.dependency_overrides.update(
                previous_overrides
            )

        self.addCleanup(restore_overrides)

        main.app.dependency_overrides[get_db] = (
            lambda: self.db
        )
        main.app.dependency_overrides[require_reviewer] = (
            lambda: self.admin
        )

        upload_patch = patch("main.upload_report_photo")
        self.upload = upload_patch.start()
        self.addCleanup(upload_patch.stop)

        self.upload.return_value = SimpleNamespace(
            public_id="test-confirmed-upload",
            asset_id="test-asset",
            width=800,
            height=600,
            byte_count=12000,
        )

        cleanup_patch = patch(
            "main.delete_confirmed_report_photo"
        )
        self.cleanup_photo = cleanup_patch.start()
        self.addCleanup(cleanup_patch.stop)

        self.client = TestClient(main.app)
        self.addCleanup(self.client.close)

        self.path = (
            f"/api/admin/reports/{self.report_id}/repair"
        )

    def submit(self, content=b"mock image contents"):
        # Image validation itself has separate tests.
        # Storage is mocked in these endpoint tests.
        return self.client.post(
            self.path,
            data={
                "note": "Repair inspected and confirmed.",
            },
            files={
                "file": (
                    "repair.jpg",
                    content,
                    "image/jpeg",
                ),
            },
        )

    def test_success_saves_photo_and_confirmation(self):
        response = self.submit()

        self.assertEqual(
            response.status_code,
            201,
            response.text,
        )

        result = response.json()

        self.assertEqual(
            result["report_id"],
            str(self.report_id),
        )
        self.assertIsNotNone(self.report.repaired_at)

        added_objects = [
            call.args[0]
            for call in self.db.add.call_args_list
        ]

        photos = [
            item
            for item in added_objects
            if isinstance(item, main.ReportPhoto)
        ]
        confirmations = [
            item
            for item in added_objects
            if isinstance(item, main.RepairConfirmation)
        ]

        self.assertEqual(len(photos), 1)
        self.assertEqual(len(confirmations), 1)

        photo = photos[0]
        confirmation = confirmations[0]

        self.assertEqual(
            confirmation.photo_id,
            photo.id,
        )
        self.assertEqual(
            confirmation.confirmed_by_uid,
            self.admin.uid,
        )
        self.assertEqual(
            photo.report_id,
            self.report_id,
        )
        self.assertEqual(
            result["photo_id"],
            str(photo.id),
        )

        self.cleanup_photo.assert_not_called()

    def test_missing_photo_is_rejected(self):
        response = self.client.post(
            self.path,
            data={
                "note": "Repair inspected and confirmed.",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.upload.assert_not_called()

    def test_missing_login_is_rejected(self):
        main.app.dependency_overrides.pop(
            require_reviewer,
        )

        response = self.submit()

        self.assertEqual(response.status_code, 401)
        self.upload.assert_not_called()

    def test_regular_user_cannot_confirm_repair(self):
        main.app.dependency_overrides.pop(
            require_reviewer,
        )
        main.app.dependency_overrides[
            require_verified_user
        ] = lambda: self.admin

        with patch(
            "security.sync_account_role",
            return_value="user",
        ):
            response = self.submit()

        self.assertEqual(response.status_code, 403)
        self.upload.assert_not_called()

    def test_pending_and_rejected_reports_are_blocked(self):
        for report_status in ("pending", "rejected"):
            with self.subTest(status=report_status):
                self.report.status = report_status
                self.db.scalar.side_effect = [
                    self.report,
                    None,
                ]

                response = self.submit()

                self.assertEqual(response.status_code, 409)

        self.upload.assert_not_called()

    def test_existing_repair_is_not_uploaded_again(self):
        for has_timestamp in (True, False):
            with self.subTest(has_timestamp=has_timestamp):
                self.report.repaired_at = (
                    datetime.now(timezone.utc)
                    if has_timestamp
                    else None
                )

                self.db.scalar.side_effect = [
                    self.report,
                    None if has_timestamp else uuid4(),
                ]

                response = self.submit()

                self.assertEqual(response.status_code, 409)

        self.upload.assert_not_called()

    def test_invalid_image_does_not_save_repair(self):
        self.upload.side_effect = PhotoValidationError(
            "Invalid JPEG or PNG."
        )

        response = self.submit()

        self.assertEqual(response.status_code, 400)
        self.db.add.assert_not_called()
        self.assertIsNone(self.report.repaired_at)
        self.cleanup_photo.assert_not_called()

    def test_oversized_photo_prevents_upload(self):
        response = self.submit(
            b"x" * (MAX_UPLOAD_BYTES + 1)
        )

        self.assertEqual(response.status_code, 413)
        self.upload.assert_not_called()
        self.db.begin.assert_not_called()

    def test_failure_before_commit_cleans_up_upload(self):
        self.db.flush.side_effect = SQLAlchemyError(
            "Internal database detail"
        )

        response = self.submit()

        self.assertEqual(response.status_code, 503)
        self.cleanup_photo.assert_called_once()
        self.assertNotIn(
            "Internal database detail",
            response.text,
        )

    def test_uncertain_commit_preserves_photo(self):
        transaction = self.db.begin.return_value
        transaction.__exit__.side_effect = SQLAlchemyError(
            "Commit connection failed"
        )

        response = self.submit()

        self.assertEqual(response.status_code, 503)
        self.cleanup_photo.assert_not_called()
        self.assertNotIn(
            "Commit connection failed",
            response.text,
        )


if __name__ == "__main__":
    unittest.main()