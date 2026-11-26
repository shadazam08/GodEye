from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from models import AppUser
from user_auth import CurrentUser


def sync_account_role(
    db: Session,
    user: CurrentUser,
) -> str:
    statement = insert(AppUser).values(
        uid=user.uid,
        email=user.email,
        display_name=user.name,
        role="user",
    )

    statement = statement.on_conflict_do_update(
        index_elements=[AppUser.uid],
        set_={
            "email": statement.excluded.email,
            "display_name": statement.excluded.display_name,
        },
    ).returning(AppUser.role)

    with db.begin():
        role = db.execute(statement).scalar_one()

    return role