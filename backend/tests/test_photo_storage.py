import os
import unittest
from copy import deepcopy
from io import BytesIO
from unittest.mock import patch
from uuid import uuid4

import cloudinary.exceptions
from PIL import Image
from urllib3.exceptions import HTTPError

from services.photo_storage import (
    PhotoStorageError,
    upload_report_photo,
)
from services.photo_validation import (
    MAX_UPLOAD_BYTES,
    PhotoValidationError,
)


class PhotoStorageTests(unittest.TestCase):
    def setUp(self):
        environment = patch.dict(
            os.environ,
            {
                "CLOUDINARY_CLOUD_NAME": "test-cloud",
                "CLOUDINARY_API_KEY": "test-key",
                "CLOUDINARY_API_SECRET": "test-secret-not-real",
            },
        )
        environment.start()
        self.addCleanup(environment.stop)

        upload_patch = patch(
            "services.photo_storage.cloudinary.uploader.upload"
        )
        self.upload = upload_patch.start()
        self.addCleanup(upload_patch.stop)

        self.photo_id = uuid4()
        self.public_id = (
            f"godeye/report-photos/{self.photo_id.hex}"
        )

        output = BytesIO()

        with Image.new("RGB", (80, 40), "blue") as image:
            image.save(output, format="PNG")

        self.raw = output.getvalue()

        self.valid_result = {
            "asset_id": "synthetic-asset-id",
            "public_id": self.public_id,
            "version": 1,
            "width": 80,
            "height": 40,
            "bytes": 300,
            "resource_type": "image",
            "type": "authenticated",
            "format": "jpg",
        }

        self.upload.return_value = deepcopy(self.valid_result)

    def assert_storage_error(self, expected_code):
        with self.assertRaises(PhotoStorageError) as caught:
            upload_report_photo(self.raw, self.photo_id)

        self.assertEqual(caught.exception.code, expected_code)
        self.assertNotIn(
            "test-secret-not-real",
            str(caught.exception),
        )

    def test_upload_uses_processed_jpeg_and_restricted_options(self):
        captured = {}

        def capture_upload(file, **options):
            captured["content"] = file.read()
            captured["filename"] = file.name
            captured["options"] = options
            return deepcopy(self.valid_result)

        self.upload.side_effect = capture_upload

        stored = upload_report_photo(self.raw, self.photo_id)

        self.upload.assert_called_once()
        self.assertEqual(stored.public_id, self.public_id)
        self.assertEqual(captured["filename"], "report.jpg")

        options = captured["options"]

        self.assertEqual(options["public_id"], self.public_id)
        self.assertEqual(options["resource_type"], "image")
        self.assertEqual(options["type"], "authenticated")
        self.assertFalse(options["overwrite"])
        self.assertFalse(options["use_filename"])
        self.assertFalse(options["unique_filename"])
        self.assertTrue(options["secure"])

        with Image.open(BytesIO(captured["content"])) as image:
            image.load()
            self.assertEqual(image.format, "JPEG")
            self.assertEqual(image.mode, "RGB")

    def test_invalid_photo_id_prevents_upload(self):
        with self.assertRaises(PhotoStorageError) as caught:
            upload_report_photo(self.raw, "not-a-uuid")

        self.assertEqual(
            caught.exception.code,
            "invalid_photo_id",
        )
        self.upload.assert_not_called()

    def test_missing_credentials_prevent_upload(self):
        for setting in (
            "CLOUDINARY_CLOUD_NAME",
            "CLOUDINARY_API_KEY",
            "CLOUDINARY_API_SECRET",
        ):
            with self.subTest(setting=setting):
                with patch.dict(os.environ, {setting: ""}):
                    self.assert_storage_error("not_configured")

        self.upload.assert_not_called()

    def test_invalid_and_oversized_files_prevent_upload(self):
        for raw in (
            b"not an image",
            b"x" * (MAX_UPLOAD_BYTES + 1),
        ):
            with self.subTest(size=len(raw)):
                with self.assertRaises(PhotoValidationError):
                    upload_report_photo(raw, self.photo_id)

        self.upload.assert_not_called()

    def test_sdk_error_does_not_expose_provider_details(self):
        self.upload.side_effect = cloudinary.exceptions.Error(
            "Provider detail: test-secret-not-real"
        )

        self.assert_storage_error("upload_unconfirmed")

    def test_network_errors_have_controlled_messages(self):
        errors = [
            HTTPError("Network detail: test-secret-not-real"),
            OSError("Connection detail: test-secret-not-real"),
        ]

        for error in errors:
            with self.subTest(error=type(error).__name__):
                self.upload.side_effect = error
                self.assert_storage_error("upload_unconfirmed")

    def test_malformed_provider_responses_are_rejected(self):
        invalid_results = [None, {}]

        changes = [
            {"type": "upload"},
            {"resource_type": "video"},
            {"format": "png"},
            {"width": 1601},
            {"bytes": -1},
            {"version": True},
        ]

        for change in changes:
            result = deepcopy(self.valid_result)
            result.update(change)
            invalid_results.append(result)

        for index, result in enumerate(invalid_results):
            with self.subTest(result=index):
                self.upload.return_value = result
                self.assert_storage_error("invalid_response")

    def test_different_public_id_is_rejected(self):
        self.upload.return_value = {
            **self.valid_result,
            "public_id": "unexpected-photo-id",
        }

        self.assert_storage_error("invalid_response")

    def test_existing_asset_is_not_accepted_as_a_new_upload(self):
        self.upload.return_value = {
            **self.valid_result,
            "existing": True,
        }

        self.assert_storage_error("upload_conflict")

    def test_extra_provider_fields_are_not_returned(self):
        self.upload.return_value = {
            **self.valid_result,
            "secure_url": "https://example.invalid/photo.jpg",
            "api_key": "test-key",
            "provider_debug": "discard this",
        }

        stored = upload_report_photo(self.raw, self.photo_id)
        result = stored.model_dump()

        self.assertNotIn("secure_url", result)
        self.assertNotIn("api_key", result)
        self.assertNotIn("provider_debug", result)


if __name__ == "__main__":
    unittest.main()