import base64
import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import main
from database import get_db
from models import Report
from user_auth import CurrentUser, require_authenticated_user


class HazardAreaEndpointTests(unittest.TestCase):
    def setUp(self):
        # Execute the actual SQL filters and pagination against an isolated DB.
        # No Neon connection or provider request is made by these tests.
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Report.__table__.create(self.engine)
        self.addCleanup(self.engine.dispose)
        self.db = Session(self.engine, expire_on_commit=False)
        self.addCleanup(self.db.close)
        self.rows = []
        self.created_at = datetime(2026, 11, 27, 10, tzinfo=timezone.utc)
        self.bounds = {"south": 26, "north": 26.2, "west": 85.8, "east": 86}

        previous_overrides = main.app.dependency_overrides.copy()

        def restore_overrides():
            main.app.dependency_overrides.clear()
            main.app.dependency_overrides.update(previous_overrides)

        self.addCleanup(restore_overrides)
        main.app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(main.app)
        self.addCleanup(self.client.close)

    def add_report(self, *, latitude=26.1, longitude=85.9, **changes):
        values = {
            "id": UUID(int=len(self.rows) + 1),
            "title": "Road damage report",
            "description": "Photo evidence of road damage at this location.",
            "location_name": "Darbhanga test road",
            "latitude": latitude,
            "longitude": longitude,
            "severity": "high",
            "status": "verified",
            "created_at": self.created_at,
            "repaired_at": None,
        }
        values.update(changes)
        report = Report(**values)
        self.rows.append(report)
        self.db.add(report)
        self.db.commit()
        return report

    def get_page(self, **changes):
        return self.client.get("/api/hazards/area", params=self.bounds | changes)

    def test_public_empty_area_has_explicit_end_and_no_store(self):
        response = self.get_page()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"items": [], "next_cursor": None})
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_area_filter_precedes_limit_and_excludes_ineligible_reports(self):
        local = self.add_report(created_at=self.created_at - timedelta(days=5))
        for index in range(205):
            self.add_report(latitude=27, created_at=self.created_at + timedelta(seconds=index))
        self.add_report(status="pending")
        self.add_report(status="rejected")
        self.add_report(repaired_at=self.created_at)
        self.add_report(latitude=25.99)
        self.add_report(longitude=86.01)

        response = self.get_page(limit=1)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([item["id"] for item in response.json()["items"]], [str(local.id)])
        self.assertIsNone(response.json()["next_cursor"])

    def test_more_than_two_hundred_reports_have_no_missing_or_duplicate_ids(self):
        for _ in range(235):
            self.add_report()

        first = self.get_page()
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(len(first.json()["items"]), 200)
        cursor = first.json()["next_cursor"]
        self.assertIsInstance(cursor, str)
        self.assertLessEqual(len(cursor), 512)

        second = self.get_page(cursor=cursor)
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(len(second.json()["items"]), 35)
        self.assertIsNone(second.json()["next_cursor"])
        ids = [item["id"] for item in first.json()["items"] + second.json()["items"]]
        self.assertEqual(ids, [str(row.id) for row in reversed(self.rows)])
        self.assertEqual(len(set(ids)), 235)

    def test_pagination_uses_timestamp_then_uuid_and_handles_an_earlier_repair(self):
        oldest = self.add_report(created_at=self.created_at - timedelta(days=1))
        middle = self.add_report()
        newest = self.add_report(created_at=self.created_at + timedelta(days=1))
        first = self.get_page(limit=1).json()
        self.assertEqual(first["items"][0]["id"], str(newest.id))

        newest.repaired_at = self.created_at
        self.db.commit()
        second = self.get_page(limit=1, cursor=first["next_cursor"]).json()
        self.assertEqual(second["items"][0]["id"], str(middle.id))
        third = self.get_page(limit=1, cursor=second["next_cursor"]).json()
        self.assertEqual(third["items"][0]["id"], str(oldest.id))
        self.assertIsNone(third["next_cursor"])

    def test_inclusive_area_edges_are_not_lost(self):
        southwest = self.add_report(latitude=26, longitude=85.8)
        northeast = self.add_report(latitude=26.2, longitude=86)
        response = self.get_page()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            {item["id"] for item in response.json()["items"]},
            {str(southwest.id), str(northeast.id)},
        )

    def test_dateline_bounds_include_both_sides_and_exclude_greenwich(self):
        east = self.add_report(longitude=179.8)
        west = self.add_report(longitude=-179.8)
        self.add_report(longitude=0)
        response = self.get_page(west=179.5, east=-179.5)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            {item["id"] for item in response.json()["items"]},
            {str(east.id), str(west.id)},
        )

    def test_invalid_and_unbounded_queries_are_rejected_before_sql(self):
        db = MagicMock()
        main.app.dependency_overrides[get_db] = lambda: db
        invalid = [
            {"south": 26.2, "north": 26},
            {"south": 26, "north": 26},
            {"north": 29},
            {"west": 85.8, "east": 85.8},
            {"west": -180, "east": 180},
            {"east": 90},
            {"south": "nan"},
            {"north": "inf"},
            {"west": -181},
            {"north": 91},
            {"limit": 0},
            {"limit": 201},
            {"cursor": ""},
            {"cursor": "a" * 513},
        ]
        for changes in invalid:
            with self.subTest(changes=changes):
                self.assertEqual(self.get_page(**changes).status_code, 422)
        self.assertEqual(self.client.get("/api/hazards/area").status_code, 422)
        db.scalars.assert_not_called()

    def test_malformed_cursor_payloads_are_rejected_before_sql(self):
        db = MagicMock()
        main.app.dependency_overrides[get_db] = lambda: db
        payloads = [
            {},
            {"version": 2},
            {
                "version": 1,
                "bounds": self.bounds,
                "created_at": "2026-11-27T10:00:00",  # Time zone is required.
                "report_id": str(UUID(int=1)),
            },
            {
                "version": 1,
                "bounds": self.bounds,
                "created_at": self.created_at.isoformat(),
                "report_id": "invalid-uuid",
            },
        ]
        cursors = ["not-a-cursor!", "a", "%%%%", "☃"] + [
            base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
            for payload in payloads
        ]
        for cursor in cursors:
            with self.subTest(cursor=cursor):
                self.assertEqual(self.get_page(cursor=cursor).status_code, 422)
        db.scalars.assert_not_called()

    def test_cursor_cannot_be_reused_for_a_different_area(self):
        self.add_report()
        self.add_report()
        cursor = self.get_page(limit=1).json()["next_cursor"]
        db = MagicMock()
        main.app.dependency_overrides[get_db] = lambda: db
        response = self.get_page(cursor=cursor, north=26.3)
        self.assertEqual(response.status_code, 422)
        db.scalars.assert_not_called()

    def test_database_error_has_safe_message_and_no_store(self):
        db = MagicMock()
        db.scalars.side_effect = SQLAlchemyError("private database detail")
        main.app.dependency_overrides[get_db] = lambda: db
        response = self.get_page()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private database detail", response.text)
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_legacy_endpoint_keeps_array_offset_pagination(self):
        for _ in range(3):
            self.add_report()
        response = self.client.get("/api/hazards", params={"limit": 1, "offset": 1})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIsInstance(response.json(), list)
        self.assertEqual(response.json()[0]["id"], str(self.rows[1].id))

    def test_my_reports_uses_authenticated_owner_and_is_not_cacheable(self):
        owner = CurrentUser(
            uid="test-owner", email="owner@example.com",
            email_verified=True, name="Owner",
        )
        main.app.dependency_overrides[require_authenticated_user] = lambda: owner
        mine = self.add_report(reporter_uid=owner.uid, status="pending")
        self.add_report(reporter_uid="another-user")
        self.add_report(reporter_uid=None)

        response = self.client.get(
            "/api/my/reports", params={"reporter_uid": "another-user"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([item["id"] for item in response.json()], [str(mine.id)])
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_my_reports_without_login_never_queries_reports(self):
        db = MagicMock()
        main.app.dependency_overrides[get_db] = lambda: db
        response = self.client.get("/api/my/reports")
        self.assertEqual(response.status_code, 401)
        db.scalars.assert_not_called()

    def test_my_reports_database_failure_is_safe_and_not_cacheable(self):
        main.app.dependency_overrides[require_authenticated_user] = lambda: CurrentUser(
            uid="test-owner", email="owner@example.com",
            email_verified=True, name="Owner",
        )
        db = MagicMock()
        db.scalars.side_effect = SQLAlchemyError("private database detail")
        main.app.dependency_overrides[get_db] = lambda: db
        response = self.client.get("/api/my/reports")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private database detail", response.text)
        self.assertEqual(response.headers["Cache-Control"], "no-store")


if __name__ == "__main__":
    unittest.main()
