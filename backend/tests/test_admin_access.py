import unittest
from unittest.mock import MagicMock, patch

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from security import require_reviewer
from user_auth import CurrentUser, require_verified_user


class AdminAccessTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()

        @self.app.get(
            "/protected",
            dependencies=[Depends(require_reviewer)],
        )
        def protected():
            return {"allowed": True}

        self.db = MagicMock()
        self.app.dependency_overrides[get_db] = lambda: self.db

        self.user = CurrentUser(
            uid="test-user-uid",
            email="user@example.com",
            email_verified=True,
            name="Test User",
        )

        role_patch = patch("security.sync_account_role")
        self.sync_role = role_patch.start()
        self.addCleanup(role_patch.stop)

        self.client = TestClient(self.app)
        self.addCleanup(self.client.close)

    def use_signed_in_user(self):
        # Token verification is replaced only inside these tests.
        self.app.dependency_overrides[
            require_verified_user
        ] = lambda: self.user

    def test_missing_login_is_rejected(self):
        response = self.client.get("/protected")

        self.assertEqual(response.status_code, 401)
        self.sync_role.assert_not_called()

    def test_regular_user_is_rejected(self):
        self.use_signed_in_user()
        self.sync_role.return_value = "user"

        response = self.client.get("/protected")

        self.assertEqual(response.status_code, 403)

    def test_admin_is_allowed(self):
        self.use_signed_in_user()
        self.sync_role.return_value = "admin"

        response = self.client.get("/protected")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"allowed": True})

        self.sync_role.assert_called_once_with(
            self.db,
            self.user,
        )

    def test_database_failure_does_not_allow_access(self):
        self.use_signed_in_user()
        self.sync_role.side_effect = SQLAlchemyError(
            "Internal database detail"
        )

        response = self.client.get("/protected")

        self.assertEqual(response.status_code, 503)
        self.assertNotIn(
            "Internal database detail",
            response.text,
        )


if __name__ == "__main__":
    unittest.main()