from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from services.accounts import sync_account_role
from user_auth import CurrentUser, require_verified_user


def require_reviewer(
    user: Annotated[
        CurrentUser,
        Depends(require_verified_user),
    ],
    db: Annotated[
        Session,
        Depends(get_db),
    ],
) -> CurrentUser:
    try:
        role = sync_account_role(db, user)

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail=(
                "Could not verify admin access. "
                "Please try again later."
            ),
        ) from None

    if role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Your account does not have admin access.",
        )

    return user