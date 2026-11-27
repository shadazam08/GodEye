import unittest
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

import main
from database import get_db


class ReadinessEndpointTests(unittest.TestCase):
    def setUp(self):
        self.db = MagicMock()
        self.db.execute.return_value.scalar_one.return_value = 1
        previous_overrides = main.app.dependency_overrides.copy()

        def restore_overrides():
            main.app.dependency_overrides.clear()
            main.app.dependency_overrides.update(previous_overrides)

        self.addCleanup(restore_overrides)
        main.app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(main.app)
        self.addCleanup(self.client.close)

    def test_ready_executes_database_probe_and_disables_caching(self):
        response = self.client.get("/api/ready")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"status": "ok", "service": "GodEye API"})
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.db.execute.assert_called_once()
        self.assertEqual(str(self.db.execute.call_args.args[0]), "SELECT 1")
        self.db.execute.return_value.scalar_one.assert_called_once_with()

    def test_database_failure_is_unready_without_exposing_provider_details(self):
        self.db.execute.side_effect = SQLAlchemyError("private connection detail")
        response = self.client.get("/api/ready")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private connection detail", response.text)
        self.assertNotEqual(response.json().get("status"), "ok")
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_result_failure_cannot_be_reported_as_ready(self):
        self.db.execute.return_value.scalar_one.side_effect = SQLAlchemyError(
            "private result detail",
        )
        response = self.client.get("/api/ready")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private result detail", response.text)

    def test_health_remains_a_process_check_without_a_database_request(self):
        self.db.execute.side_effect = SQLAlchemyError("database is unavailable")
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"status": "ok", "service": "GodEye API"})
        self.db.execute.assert_not_called()


if __name__ == "__main__":
    unittest.main()
