import warnings
from io import BytesIO

from PIL import Image, ImageOps


MAX_UPLOAD_BYTES = 3 * 1024 * 1024
MAX_INPUT_PIXELS = 20_000_000
MAX_OUTPUT_SIDE = 1600

ALLOWED_FORMATS = ["JPEG", "PNG"]


class PhotoValidationError(ValueError):
    pass


def prepare_report_photo(raw: bytes) -> bytes:
    if not isinstance(raw, bytes) or not raw:
        raise PhotoValidationError("Please select a photo.")

    if len(raw) > MAX_UPLOAD_BYTES:
        raise PhotoValidationError(
            "Photo must be 3 MiB or smaller."
        )

    try:
        with warnings.catch_warnings():
            warnings.simplefilter(
                "error",
                Image.DecompressionBombWarning,
            )

            # Inspect the file before decoding its full pixel data.
            with Image.open(
                BytesIO(raw),
                formats=ALLOWED_FORMATS,
            ) as probe:
                width, height = probe.size

                if width < 1 or height < 1:
                    raise PhotoValidationError(
                        "Photo dimensions are invalid."
                    )

                if width * height > MAX_INPUT_PIXELS:
                    raise PhotoValidationError(
                        "Photo resolution must not exceed 20 megapixels."
                    )

                if getattr(probe, "n_frames", 1) != 1:
                    raise PhotoValidationError(
                        "Animated or multi-frame images are not supported."
                    )

                probe.verify()

            # Pillow requires reopening after verify().
            with Image.open(
                BytesIO(raw),
                formats=ALLOWED_FORMATS,
            ) as source:
                oriented = ImageOps.exif_transpose(source)

                try:
                    oriented.thumbnail(
                        (MAX_OUTPUT_SIDE, MAX_OUTPUT_SIDE),
                        Image.Resampling.LANCZOS,
                    )

                    output = BytesIO()

                    # Use a fresh image so source metadata is not copied.
                    # Transparent PNG areas are flattened onto white.
                    with oriented.convert("RGBA") as pixels:
                        with Image.new(
                            "RGB",
                            pixels.size,
                            "white",
                        ) as clean:
                            with pixels.getchannel("A") as alpha:
                                clean.paste(
                                    pixels,
                                    (0, 0),
                                    alpha,
                                )

                            clean.save(
                                output,
                                format="JPEG",
                                quality=85,
                                optimize=True,
                                exif=b"",
                                icc_profile=None,
                            )

                    prepared = output.getvalue()

                finally:
                    oriented.close()

    except PhotoValidationError:
        raise

    except (
        OSError,
        ValueError,
        SyntaxError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise PhotoValidationError(
            "The file could not be processed as a valid JPEG or PNG photo."
        ) from None

    if not prepared or len(prepared) > MAX_UPLOAD_BYTES:
        raise PhotoValidationError(
            "The processed photo exceeds the allowed size."
        )

    return prepared