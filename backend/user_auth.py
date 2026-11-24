import os
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated

import requests
from cachecontrol import CacheControl
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from google.auth import exceptions as google_auth_errors
from google.auth.transport.requests import Request
from google.oauth2 import id_token


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

user_bearer = HTTPBearer(
    auto_error=False,
    scheme_name="User login",
)

transport_state = threading.local()


class CertificateRequest(Request):
    def __call__(self, *args, **kwargs):
        kwargs["timeout"] = 5
        return super().__call__(*args, **kwargs)


def get_certificate_request():
    if not hasattr(transport_state, "request"):
        session = CacheControl(requests.Session())

        transport_state.request = CertificateRequest(
            session=session,
        )

    return transport_state.request


@dataclass(frozen=True)
class CurrentUser:
    uid: str
    email: str | None
    email_verified: bool
    name: str | None


def unauthorized():
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Please sign in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_authenticated_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(user_bearer),
    ],
) -> CurrentUser:
    if credentials is None:
        raise unauthorized()

    project_id = os.getenv("FIREBASE_PROJECT_ID", "").strip()

    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="User authentication is not configured.",
        )

    token = credentials.credentials

    if not token or len(token) > 16384:
        raise unauthorized()

    try:
        claims = id_token.verify_firebase_token(
            token,
            get_certificate_request(),
            audience=project_id,
        )
    except google_auth_errors.TransportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not verify login right now. Try again later.",
        ) from None
    except (ValueError, google_auth_errors.GoogleAuthError):
        raise unauthorized() from None

    expected_issuer = f"https://securetoken.google.com/{project_id}"

    if (
        claims.get("aud") != project_id
        or claims.get("iss") != expected_issuer
    ):
        raise unauthorized()

    uid = claims.get("sub")

    if not isinstance(uid, str) or not uid or len(uid) > 128:
        raise unauthorized()

    auth_time = claims.get("auth_time")

    if (
        isinstance(auth_time, bool)
        or not isinstance(auth_time, (int, float))
        or not 0 <= auth_time <= time.time()
    ):
        raise unauthorized()

    email = claims.get("email")
    name = claims.get("name")

    return CurrentUser(
        uid=uid,
        email=email if isinstance(email, str) else None,
        email_verified=claims.get("email_verified") is True,
        name=name if isinstance(name, str) else None,
    )


def require_verified_user(
    user: Annotated[
        CurrentUser,
        Depends(require_authenticated_user),
    ],
) -> CurrentUser:
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A verified email is required to submit reports.",
        )

    return user