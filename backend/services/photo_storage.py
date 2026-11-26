import os
from io import BytesIO
from pathlib import Path
from typing import Literal
from uuid import UUID
import time
import cloudinary.utils
import cloudinary.exceptions
import cloudinary.uploader
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from urllib3.exceptions import HTTPError

from services.photo_validation import (
    MAX_OUTPUT_SIDE,
    MAX_UPLOAD_BYTES,
    prepare_report_photo,
)


BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


class PhotoStorageError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class StoredPhoto(BaseModel):
    model_config = ConfigDict(
        extra="ignore",
        strict=True,
    )

    asset_id: str = Field(min_length=1)
    public_id: str = Field(min_length=1)
    version: int = Field(gt=0)

    width: int = Field(gt=0, le=MAX_OUTPUT_SIDE)
    height: int = Field(gt=0, le=MAX_OUTPUT_SIDE)

    byte_count: int = Field(
        alias="bytes",
        gt=0,
        le=MAX_UPLOAD_BYTES,
    )

    resource_type: Literal["image"]
    delivery_type: Literal["authenticated"] = Field(alias="type")
    image_format: Literal["jpg"] = Field(alias="format")


def upload_report_photo(
    raw: bytes,
    photo_id: UUID,
) -> StoredPhoto:
    if not isinstance(photo_id, UUID):
        raise PhotoStorageError(
            "invalid_photo_id",
            "A valid server-generated photo ID is required.",
        )

    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()

    if not all((cloud_name, api_key, api_secret)):
        raise PhotoStorageError(
            "not_configured",
            "Photo storage is not configured.",
        )

    # Invalid files are rejected before making a storage request.
    prepared = prepare_report_photo(raw)

    public_id = f"godeye/report-photos/{photo_id.hex}"

    try:
        with BytesIO(prepared) as photo_file:
            photo_file.name = "report.jpg"

            result = cloudinary.uploader.upload(
                photo_file,
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret,
                secure=True,
                resource_type="image",
                type="authenticated",
                public_id=public_id,
                overwrite=False,
                use_filename=False,
                unique_filename=False,
                timeout=20,
            )

    except (
        cloudinary.exceptions.Error,
        HTTPError,
        OSError,
        ValueError,
    ):
        raise PhotoStorageError(
            "upload_unconfirmed",
            "Photo upload could not be confirmed.",
        ) from None

    if isinstance(result, dict) and result.get("existing") is True:
        raise PhotoStorageError(
            "upload_conflict",
            "The photo storage ID is already in use.",
        )

    try:
        stored = StoredPhoto.model_validate(result)
    except ValidationError:
        raise PhotoStorageError(
            "invalid_response",
            "Photo storage returned an unexpected response.",
        ) from None

    if stored.public_id != public_id:
        raise PhotoStorageError(
            "invalid_response",
            "Photo storage returned a different photo identifier.",
        )

    return stored

def delete_confirmed_report_photo(
    photo_id: UUID,
    stored: StoredPhoto,
) -> None:
    """Delete a confirmed upload during internal cleanup."""

    if not isinstance(photo_id, UUID):
        raise PhotoStorageError(
            "invalid_photo_id",
            "A valid server-generated photo ID is required.",
        )

    if not isinstance(stored, StoredPhoto):
        raise PhotoStorageError(
            "invalid_photo",
            "A confirmed photo upload is required.",
        )

    expected_public_id = (
        f"godeye/report-photos/{photo_id.hex}"
    )

    if stored.public_id != expected_public_id:
        raise PhotoStorageError(
            "invalid_photo",
            "The photo identifier does not match.",
        )

    cloud_name = os.getenv(
        "CLOUDINARY_CLOUD_NAME", ""
    ).strip()
    api_key = os.getenv(
        "CLOUDINARY_API_KEY", ""
    ).strip()
    api_secret = os.getenv(
        "CLOUDINARY_API_SECRET", ""
    ).strip()

    if not all((cloud_name, api_key, api_secret)):
        raise PhotoStorageError(
            "not_configured",
            "Photo storage is not configured.",
        )

    try:
        result = cloudinary.uploader.destroy(
            expected_public_id,
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True,
            resource_type="image",
            type="authenticated",
            invalidate=True,
            timeout=20,
        )

    except (
        cloudinary.exceptions.Error,
        HTTPError,
        OSError,
        ValueError,
    ):
        raise PhotoStorageError(
            "cleanup_unconfirmed",
            "Photo cleanup could not be confirmed.",
        ) from None

    if (
        not isinstance(result, dict)
        or result.get("result") not in ("ok", "not found")
    ):
        raise PhotoStorageError(
            "cleanup_unconfirmed",
            "Photo cleanup could not be confirmed.",
        )

def create_report_photo_preview(
    photo_id: UUID,
    public_id: str,
) -> tuple[str, int]:
    if not isinstance(photo_id, UUID):
        raise PhotoStorageError(
            "invalid_photo_id",
            "A valid photo ID is required.",
        )

    expected_public_id = (
        f"godeye/report-photos/{photo_id.hex}"
    )

    if public_id != expected_public_id:
        raise PhotoStorageError(
            "invalid_photo",
            "The photo identifier does not match.",
        )

    cloud_name = os.getenv(
        "CLOUDINARY_CLOUD_NAME", ""
    ).strip()
    api_key = os.getenv(
        "CLOUDINARY_API_KEY", ""
    ).strip()
    api_secret = os.getenv(
        "CLOUDINARY_API_SECRET", ""
    ).strip()

    if not all((cloud_name, api_key, api_secret)):
        raise PhotoStorageError(
            "not_configured",
            "Photo storage is not configured.",
        )

    expires_at = int(time.time()) + 60

    try:
        url = cloudinary.utils.private_download_url(
            public_id,
            "jpg",
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True,
            resource_type="image",
            type="authenticated",
            expires_at=expires_at,
            attachment=False,
        )
    except (
        cloudinary.exceptions.Error,
        OSError,
        ValueError,
    ):
        raise PhotoStorageError(
            "preview_unavailable",
            "Photo preview could not be prepared.",
        ) from None

    return url, expires_at