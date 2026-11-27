import unittest
from unittest.mock import patch

from fastapi import Depends, FastAPI
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
from google.auth import exceptions as google_auth_errors

from user_auth import (
    CurrentUser,
    require_authenticated_user,
    require_verified_user,
)


class UserAuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.claims = {
            "aud": "test-project",
            "iss": "https://securetoken.google.com/test-project",
            "sub": "test-user",
            "auth_time": 900,
            "email": "user@example.com",
            "email_verified": True,
            "name": "Test User",
        }

        project_patch = patch(
            "user_auth.os.getenv",
            return_value="test-project",
        )
        self.project_setting = project_patch.start()
        self.addCleanup(project_patch.stop)

        clock_patch = patch("user_auth.time.time", return_value=1000)
        clock_patch.start()
        self.addCleanup(clock_patch.stop)

        request_patch = patch("user_auth.get_certificate_request")
        self.certificate_request = request_patch.start()
        self.addCleanup(request_patch.stop)

        verifier_patch = patch("user_auth.id_token.verify_firebase_token")
        self.verify_token = verifier_patch.start()
        self.verify_token.return_value = self.claims
        self.addCleanup(verifier_patch.stop)

        app = FastAPI()

        @app.get("/authenticated")
        def authenticated(user: CurrentUser = Depends(require_authenticated_user)):
            return {"uid": user.uid}

        @app.get("/verified")
        def verified(user: CurrentUser = Depends(require_verified_user)):
            return {"uid": user.uid}

        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def get_authenticated(self):
        return self.client.get(
            "/authenticated",
            headers={"Authorization": "Bearer test-token"},
        )

    def assert_unauthorized(self, response):
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers["www-authenticate"], "Bearer")
        self.assertEqual(response.json(), {"detail": "Please sign in again."})

    def test_valid_token_uses_project_audience_and_verified_identity(self):
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer", credentials="test-token"
        )

        user = require_authenticated_user(credentials)

        self.assertEqual(
            user,
            CurrentUser(
                uid="test-user",
                email="user@example.com",
                email_verified=True,
                name="Test User",
            ),
        )
        self.verify_token.assert_called_once_with(
            "test-token",
            self.certificate_request.return_value,
            audience="test-project",
        )

    def test_valid_login_passes_both_authentication_dependencies(self):
        response = self.client.get(
            "/verified",
            headers={"Authorization": "Bearer test-token"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"uid": "test-user"})

    def test_missing_empty_or_wrong_scheme_token_is_rejected(self):
        for authorization in (None, "Bearer", "Bearer ", "Basic test-token"):
            with self.subTest(authorization=authorization):
                headers = (
                    {"Authorization": authorization}
                    if authorization is not None
                    else {}
                )
                self.assert_unauthorized(
                    self.client.get("/authenticated", headers=headers)
                )

        self.verify_token.assert_not_called()
        self.certificate_request.assert_not_called()

    def test_oversized_token_is_rejected_before_certificate_lookup(self):
        response = self.client.get(
            "/authenticated",
            headers={"Authorization": "Bearer " + "x" * 16385},
        )

        self.assert_unauthorized(response)
        self.verify_token.assert_not_called()
        self.certificate_request.assert_not_called()

    def test_missing_project_is_service_unavailable(self):
        self.project_setting.return_value = "  "

        response = self.get_authenticated()

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json(),
            {"detail": "User authentication is not configured."},
        )
        self.verify_token.assert_not_called()

    def test_wrong_or_missing_audience_and_issuer_are_rejected(self):
        for field in ("aud", "iss"):
            for value in (None, "another-project"):
                with self.subTest(field=field, value=value):
                    self.verify_token.return_value = {**self.claims, field: value}
                    self.assert_unauthorized(self.get_authenticated())

    def test_invalid_uid_is_rejected(self):
        for uid in (None, "", 123, "x" * 129):
            with self.subTest(uid=uid):
                self.verify_token.return_value = {**self.claims, "sub": uid}
                self.assert_unauthorized(self.get_authenticated())

    def test_invalid_authentication_time_is_rejected(self):
        for auth_time in (
            None, True, "900", -1, 1001, float("nan"), float("inf")
        ):
            with self.subTest(auth_time=auth_time):
                self.verify_token.return_value = {
                    **self.claims, "auth_time": auth_time
                }
                self.assert_unauthorized(self.get_authenticated())

    def test_invalid_signature_is_rejected_without_internal_details(self):
        for error in (
            ValueError("Internal signature detail"),
            google_auth_errors.GoogleAuthError("Internal signature detail"),
        ):
            with self.subTest(error=type(error).__name__):
                self.verify_token.side_effect = error
                response = self.get_authenticated()
                self.assert_unauthorized(response)
                self.assertNotIn("Internal signature detail", response.text)

    def test_certificate_transport_failure_is_service_unavailable(self):
        self.verify_token.side_effect = google_auth_errors.TransportError(
            "Internal transport detail"
        )

        response = self.get_authenticated()

        self.assertEqual(response.status_code, 503)
        self.assertNotIn("Internal transport detail", response.text)

    def test_unverified_email_cannot_pass_verified_dependency(self):
        for verified in (False, None, "true", 1):
            with self.subTest(email_verified=verified):
                self.verify_token.return_value = {
                    **self.claims, "email_verified": verified
                }
                response = self.client.get(
                    "/verified",
                    headers={"Authorization": "Bearer test-token"},
                )
                self.assertEqual(response.status_code, 403)

    def test_optional_profile_claims_do_not_replace_identity(self):
        self.verify_token.return_value = {
            **self.claims, "email": 123, "name": ["unexpected"]
        }

        user = require_authenticated_user(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials="test-token")
        )

        self.assertEqual(user.uid, "test-user")
        self.assertIsNone(user.email)
        self.assertIsNone(user.name)


if __name__ == "__main__":
    unittest.main()
