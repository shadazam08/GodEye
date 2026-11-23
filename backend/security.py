import os
import secrets
from pathlib import Path
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

bearer_scheme = HTTPBearer(
    auto_error=False,
    scheme_name="Reviewer access",
)


def require_reviewer(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> None:
    expected_key = os.getenv("REVIEWER_API_KEY")

    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Reviewer access is not configured.",
        )

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Reviewer credentials are required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    valid_key = secrets.compare_digest(
        credentials.credentials.encode("utf-8"),
        expected_key.encode("utf-8"),
    )

    if not valid_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid reviewer credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )