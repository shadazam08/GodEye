import unittest
from io import BytesIO
from unittest.mock import patch

from PIL import Image

from services.photo_validation import (
    MAX_UPLOAD_BYTES,
    PhotoValidationError,
    prepare_report_photo,
)


def make_image_bytes(
    image_format="JPEG",
    size=(80, 40),
    mode="RGB",
    color=(200, 50, 50),
    **save_options,
):
    output = BytesIO()

    with Image.new(mode, size, color) as image:
        image.save(
            output,
            format=image_format,
            **save_options,
        )

    return output.getvalue()


class PhotoValidationTests(unittest.TestCase):
    def test_jpeg_becomes_readable_rgb_jpeg(self):
        raw = make_image_bytes()

        prepared = prepare_report_photo(raw)

        with Image.open(BytesIO(prepared)) as image:
            image.load()

            self.assertEqual(image.format, "JPEG")
            self.assertEqual(image.mode, "RGB")
            self.assertEqual(image.size, (80, 40))

    def test_transparent_png_is_flattened_onto_white(self):
        raw = make_image_bytes(
            image_format="PNG",
            mode="RGBA",
            color=(255, 0, 0, 0),
        )

        prepared = prepare_report_photo(raw)

        with Image.open(BytesIO(prepared)) as image:
            self.assertEqual(image.format, "JPEG")
            self.assertEqual(image.mode, "RGB")

            pixel = image.getpixel((10, 10))
            self.assertTrue(all(channel >= 250 for channel in pixel))

    def test_large_image_is_resized_with_aspect_ratio(self):
        raw = make_image_bytes(size=(2400, 1200))

        prepared = prepare_report_photo(raw)

        with Image.open(BytesIO(prepared)) as image:
            self.assertEqual(image.size, (1600, 800))

    def test_small_image_is_not_upscaled(self):
        raw = make_image_bytes(size=(64, 32))

        prepared = prepare_report_photo(raw)

        with Image.open(BytesIO(prepared)) as image:
            self.assertEqual(image.size, (64, 32))

    def test_exif_orientation_is_applied_and_metadata_removed(self):
        exif = Image.Exif()
        exif[274] = 6
        exif[315] = "Synthetic test author"

        raw = make_image_bytes(
            size=(80, 40),
            exif=exif,
            icc_profile=b"synthetic-test-profile",
        )

        prepared = prepare_report_photo(raw)

        with Image.open(BytesIO(prepared)) as image:
            self.assertEqual(image.size, (40, 80))
            self.assertEqual(len(image.getexif()), 0)
            self.assertNotIn("icc_profile", image.info)

    def test_empty_and_non_image_files_are_rejected(self):
        invalid_files = [
            b"",
            b"this is not an image",
            b"<svg xmlns='http://www.w3.org/2000/svg'></svg>",
        ]

        for index, raw in enumerate(invalid_files):
            with self.subTest(file=index):
                with self.assertRaises(PhotoValidationError):
                    prepare_report_photo(raw)

    def test_oversized_upload_is_rejected(self):
        raw = b"x" * (MAX_UPLOAD_BYTES + 1)

        with self.assertRaisesRegex(
            PhotoValidationError,
            "3 MiB",
        ):
            prepare_report_photo(raw)

    def test_pixel_limit_boundary_is_enforced(self):
        allowed = make_image_bytes(
            image_format="PNG",
            size=(10, 10),
        )
        too_large = make_image_bytes(
            image_format="PNG",
            size=(11, 10),
        )

        # Test the boundary without allocating a huge image.
        with patch(
            "services.photo_validation.MAX_INPUT_PIXELS",
            100,
        ):
            self.assertTrue(prepare_report_photo(allowed))

            with self.assertRaises(PhotoValidationError):
                prepare_report_photo(too_large)

    def test_gif_is_rejected_even_when_it_is_a_valid_image(self):
        raw = make_image_bytes(image_format="GIF")

        with self.assertRaises(PhotoValidationError):
            prepare_report_photo(raw)

    def test_animated_png_is_rejected(self):
        output = BytesIO()

        with Image.new("RGB", (20, 20), "red") as first:
            with Image.new("RGB", (20, 20), "blue") as second:
                first.save(
                    output,
                    format="PNG",
                    save_all=True,
                    append_images=[second],
                    duration=100,
                    loop=0,
                )

        with self.assertRaisesRegex(
            PhotoValidationError,
            "Animated",
        ):
            prepare_report_photo(output.getvalue())

    def test_truncated_jpeg_is_rejected(self):
        raw = make_image_bytes()
        truncated = raw[: len(raw) // 2]

        with self.assertRaises(PhotoValidationError):
            prepare_report_photo(truncated)


if __name__ == "__main__":
    unittest.main()