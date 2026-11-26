import unittest
from datetime import datetime, timezone
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy.exc import SQLAlchemyError

import main
from services.photo_storage import (
    PhotoStorageError,
    StoredPhoto,
)
from services.photo_validation import (
    MAX_UPLOAD_BYTES,
    PhotoValidationError,
)


class PhotoEndpointTests(unittest.TestCase):
    def setUp(self):
        self.report_id = uuid4()
        self.photo_id = uuid4()
        self.user = SimpleNamespace(uid="test-user")

        self.report = SimpleNamespace(
            id=self.report_id,
            reporter_uid=self.user.uid,
            status="pending",
        )

        self.db = MagicMock()
        self.db.scalar.side_effect = [self.report, 0]

        def refresh_photo(photo):
            photo.created_at = datetime.now(timezone.utc)

        self.db.refresh.side_effect = refresh_photo

        upload_patch = patch("main.upload_report_photo")
        self.upload = upload_patch.start()
        self.addCleanup(upload_patch.stop)

        cleanup_patch = patch(
            "main.delete_confirmed_report_photo"
        )
        self.cleanup = cleanup_patch.start()
        self.addCleanup(cleanup_patch.stop)

        id_patch = patch(
            "main.uuid4",
            return_value=self.photo_id,
        )
        id_patch.start()
        self.addCleanup(id_patch.stop)

        self.stored = StoredPhoto.model_validate({
            "asset_id": "test-asset",
            "public_id": (
                f"godeye/report-photos/{self.photo_id.hex}"
            ),
            "version": 1,
            "width": 640,
            "height": 480,
            "bytes": 1024,
            "resource_type": "image",
            "type": "authenticated",
            "format": "jpg",
        })
        self.upload.return_value = self.stored

    def call_endpoint(self, raw=b"mock-photo"):
        # Image processing is tested separately.
        # These tests mock storage to isolate the endpoint.
        with BytesIO(raw) as stream:
            file = UploadFile(
                filename="photo.jpg",
                file=stream,
            )

            return main.add_report_photo(
                report_id=self.report_id,
                db=self.db,
                user=self.user,
                file=file,
            )

    def assert_http_error(self, expected_status):
        with self.assertRaises(HTTPException) as caught:
            self.call_endpoint()

        self.assertEqual(
            caught.exception.status_code,
            expected_status,
        )

    def test_success_returns_photo_metadata(self):
        result = self.call_endpoint()

        self.assertEqual(result.id, self.photo_id)
        self.assertEqual(result.report_id, self.report_id)
        self.assertEqual(result.width, 640)
        self.assertEqual(result.height, 480)
        self.assertEqual(result.byte_size, 1024)

        saved_photo = self.db.add.call_args.args[0]

        self.assertEqual(
            saved_photo.uploaded_by_uid,
            self.user.uid,
        )
        self.assertEqual(
            saved_photo.public_id,
            self.stored.public_id,
        )

        self.upload.assert_called_once_with(
            b"mock-photo",
            self.photo_id,
        )
        self.cleanup.assert_not_called()

        response = result.model_dump()
        self.assertNotIn("uploaded_by_uid", response)
        self.assertNotIn("public_id", response)
        self.assertNotIn("asset_id", response)

    def test_missing_or_unowned_report_prevents_upload(self):
        # The ownership-filtered database lookup found no row.
        self.db.scalar.side_effect = [None]

        self.assert_http_error(404)

        self.upload.assert_not_called()
        self.db.add.assert_not_called()

    def test_reviewed_reports_prevent_upload(self):
        for report_status in ("verified", "rejected"):
            with self.subTest(status=report_status):
                self.report.status = report_status
                self.db.scalar.side_effect = [self.report]

                self.assert_http_error(409)

        self.upload.assert_not_called()
        self.db.add.assert_not_called()

    def test_three_existing_photos_prevent_upload(self):
        self.db.scalar.side_effect = [self.report, 3]

        self.assert_http_error(409)

        self.upload.assert_not_called()
        self.db.add.assert_not_called()

    def test_oversized_file_prevents_database_and_storage_calls(self):
        with self.assertRaises(HTTPException) as caught:
            self.call_endpoint(
                b"x" * (MAX_UPLOAD_BYTES + 1)
            )

        self.assertEqual(
            caught.exception.status_code,
            413,
        )
        self.db.begin.assert_not_called()
        self.upload.assert_not_called()

    def test_invalid_image_does_not_create_photo_record(self):
        self.upload.side_effect = PhotoValidationError(
            "Invalid photo."
        )

        self.assert_http_error(400)

        self.db.add.assert_not_called()
        self.cleanup.assert_not_called()

    def test_flush_failure_cleans_up_confirmed_upload(self):
        self.db.flush.side_effect = SQLAlchemyError(
            "Simulated database failure"
        )

        self.assert_http_error(503)

        self.cleanup.assert_called_once_with(
            self.photo_id,
            self.stored,
        )

    def test_uncertain_commit_preserves_uploaded_photo(self):
        transaction = (
            self.db.begin.return_value
        )
        transaction.__exit__.side_effect = (
            SQLAlchemyError(
                "Simulated connection loss during commit"
            )
        )

        with self.assertLogs(
            main.logger,
            level="WARNING",
        ):
            self.assert_http_error(503)

        self.upload.assert_called_once()
        self.cleanup.assert_not_called()

    def test_cleanup_failure_does_not_hide_database_failure(self):
        self.db.flush.side_effect = SQLAlchemyError(
            "Simulated database failure"
        )
        self.cleanup.side_effect = PhotoStorageError(
            "cleanup_unconfirmed",
            "Photo cleanup could not be confirmed.",
        )

        with self.assertLogs(
            main.logger,
            level="WARNING",
        ):
            with self.assertRaises(HTTPException) as caught:
                self.call_endpoint()

        self.assertEqual(
            caught.exception.status_code,
            503,
        )
        self.assertIn(
            "Photo save could not be confirmed",
            caught.exception.detail,
        )


if __name__ == "__main__":
    unittest.main()