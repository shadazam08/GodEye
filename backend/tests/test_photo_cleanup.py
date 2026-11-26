import os
import unittest
from unittest.mock import patch
from uuid import UUID

import cloudinary.exceptions

from services.photo_storage import (
    PhotoStorageError,
    StoredPhoto,
    delete_confirmed_report_photo,
)


class PhotoCleanupTests(unittest.TestCase):
    def setUp(self):
        environment = patch.dict(
            os.environ,
            {
                "CLOUDINARY_CLOUD_NAME": "test-cloud",
                "CLOUDINARY_API_KEY": "test-key",
                "CLOUDINARY_API_SECRET": "test-secret",
            },
        )
        environment.start()
        self.addCleanup(environment.stop)

        destroy_patch = patch(
            "services.photo_storage.cloudinary.uploader.destroy"
        )
        self.destroy = destroy_patch.start()
        self.addCleanup(destroy_patch.stop)

        self.destroy.return_value = {"result": "ok"}

        self.photo_id = UUID(
            "93c2d0ab-97fc-4c94-a778-37cac17c3e88"
        )

        self.photo_data = {
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
        }

        self.stored = StoredPhoto.model_validate(
            self.photo_data
        )

    def assert_cleanup_error(self, expected_code):
        with self.assertRaises(PhotoStorageError) as caught:
            delete_confirmed_report_photo(
                self.photo_id,
                self.stored,
            )

        self.assertEqual(
            caught.exception.code,
            expected_code,
        )
        self.assertNotIn(
            "test-secret",
            str(caught.exception),
        )

    def test_confirmed_photo_uses_restricted_delete_options(self):
        result = delete_confirmed_report_photo(
            self.photo_id,
            self.stored,
        )

        self.assertIsNone(result)
        self.destroy.assert_called_once_with(
            self.stored.public_id,
            cloud_name="test-cloud",
            api_key="test-key",
            api_secret="test-secret",
            secure=True,
            resource_type="image",
            type="authenticated",
            invalidate=True,
            timeout=20,
        )

    def test_already_missing_photo_is_accepted(self):
        self.destroy.return_value = {
            "result": "not found",
        }

        delete_confirmed_report_photo(
            self.photo_id,
            self.stored,
        )

        self.destroy.assert_called_once()

    def test_invalid_photo_id_prevents_delete(self):
        with self.assertRaises(PhotoStorageError) as caught:
            delete_confirmed_report_photo(
                "not-a-uuid",
                self.stored,
            )

        self.assertEqual(
            caught.exception.code,
            "invalid_photo_id",
        )
        self.destroy.assert_not_called()

    def test_unconfirmed_photo_prevents_delete(self):
        with self.assertRaises(PhotoStorageError) as caught:
            delete_confirmed_report_photo(
                self.photo_id,
                self.photo_data,
            )

        self.assertEqual(
            caught.exception.code,
            "invalid_photo",
        )
        self.destroy.assert_not_called()

    def test_different_public_id_prevents_delete(self):
        self.stored = StoredPhoto.model_validate({
            **self.photo_data,
            "public_id": "another-folder/another-photo",
        })

        self.assert_cleanup_error("invalid_photo")
        self.destroy.assert_not_called()

    def test_missing_credentials_prevent_delete(self):
        for variable in (
            "CLOUDINARY_CLOUD_NAME",
            "CLOUDINARY_API_KEY",
            "CLOUDINARY_API_SECRET",
        ):
            with self.subTest(variable=variable):
                with patch.dict(
                    os.environ,
                    {variable: ""},
                ):
                    self.assert_cleanup_error(
                        "not_configured"
                    )

        self.destroy.assert_not_called()

    def test_provider_errors_have_controlled_messages(self):
        errors = [
            cloudinary.exceptions.Error(
                "Provider detail containing test-secret"
            ),
            OSError(
                "Network detail containing test-secret"
            ),
        ]

        for error in errors:
            with self.subTest(error=type(error).__name__):
                self.destroy.side_effect = error

                self.assert_cleanup_error(
                    "cleanup_unconfirmed"
                )

    def test_unexpected_responses_are_not_accepted(self):
        responses = [
            None,
            [],
            {},
            {"result": "unexpected"},
        ]

        for response in responses:
            with self.subTest(response=response):
                self.destroy.return_value = response

                self.assert_cleanup_error(
                    "cleanup_unconfirmed"
                )


if __name__ == "__main__":
    unittest.main()