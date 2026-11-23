import os
import unittest
from unittest.mock import patch

import httpx

from schemas import MapMatchRequest
from services.map_matching import (
    MapMatchingError,
    match_location_samples,
)


class MapMatchingTests(unittest.TestCase):
    def setUp(self):
        # This is a dummy key, not a real credential.
        environment = patch.dict(
            os.environ,
            {"GEOAPIFY_API_KEY": "test-key-not-real"},
        )
        environment.start()
        self.addCleanup(environment.stop)

        client_patch = patch(
            "services.map_matching.httpx.Client"
        )
        self.client_factory = client_patch.start()
        self.addCleanup(client_patch.stop)

        self.client = (
            self.client_factory.return_value
            .__enter__.return_value
        )

        self.client.post.return_value = httpx.Response(
            200,
            json={
                "type": "FeatureCollection",
                "features": [],
            },
        )

        self.request = MapMatchRequest.model_validate({
            "mode": "drive",
            "samples": [
                {
                    "latitude": 26.1542,
                    "longitude": 85.8918,
                    "timestamp": "2026-11-23T10:00:00+05:30",
                    "accuracy": 10,
                    "heading": 0,
                },
                {
                    "latitude": 26.1546,
                    "longitude": 85.8920,
                    "timestamp": "2026-11-23T10:00:10+05:30",
                    "accuracy": 12,
                },
            ],
        })

    def assert_service_error(self, expected_code):
        with self.assertRaises(MapMatchingError) as caught:
            match_location_samples(self.request)

        self.assertEqual(
            caught.exception.code,
            expected_code,
        )
        self.assertNotIn(
            "test-key-not-real",
            str(caught.exception),
        )

    def test_request_format_and_utc_conversion(self):
        match_location_samples(self.request)

        self.client.post.assert_called_once()

        call = self.client.post.call_args
        payload = call.kwargs["json"]

        self.assertEqual(
            call.args[0],
            "https://api.geoapify.com/v1/mapmatching",
        )
        self.assertEqual(
            call.kwargs["params"],
            {"apiKey": "test-key-not-real"},
        )
        self.assertEqual(payload["mode"], "drive")
        self.assertEqual(
            payload["waypoints"][0]["location"],
            [85.8918, 26.1542],
        )
        self.assertEqual(
            payload["waypoints"][0]["timestamp"],
            "2026-11-23T04:30:00.000Z",
        )
        self.assertEqual(
            payload["waypoints"][0]["bearing"],
            0,
        )
        self.assertFalse(payload["geocode_step_address"])
        self.assertFalse(payload["lookup_step_osmtags"])
        self.assertNotIn(
            "accuracy",
            payload["waypoints"][0],
        )

    def test_missing_heading_is_not_fabricated(self):
        match_location_samples(self.request)

        payload = self.client.post.call_args.kwargs["json"]

        self.assertNotIn(
            "bearing",
            payload["waypoints"][1],
        )

    def test_missing_key_prevents_provider_request(self):
        with patch.dict(
            os.environ,
            {"GEOAPIFY_API_KEY": ""},
        ):
            self.assert_service_error("not_configured")

        self.client_factory.assert_not_called()

    def test_timeout_has_safe_error(self):
        self.client.post.side_effect = httpx.ReadTimeout(
            "Dummy request containing test-key-not-real"
        )

        self.assert_service_error("timeout")
        self.client.post.assert_called_once()

    def test_network_failure_has_safe_error(self):
        self.client.post.side_effect = httpx.ConnectError(
            "Dummy request containing test-key-not-real"
        )

        self.assert_service_error("network_error")

    def test_provider_access_failures(self):
        for status_code in (401, 403):
            with self.subTest(status_code=status_code):
                self.client.post.return_value = httpx.Response(
                    status_code,
                    text="Provider detail containing test-key-not-real",
                )

                self.assert_service_error(
                    "provider_access_error"
                )

    def test_rate_limit(self):
        self.client.post.return_value = httpx.Response(429)

        self.assert_service_error("quota_or_rate_limit")

    def test_other_unsuccessful_statuses(self):
        for status_code in (400, 302, 500):
            with self.subTest(status_code=status_code):
                self.client.post.return_value = httpx.Response(
                    status_code
                )

                self.assert_service_error("provider_error")

    def test_invalid_provider_responses(self):
        responses = [
            httpx.Response(200, content=b"not-json"),
            httpx.Response(200, json=[]),
            httpx.Response(
                200,
                json={
                    "type": "FeatureCollection",
                    "features": "invalid",
                },
            ),
            httpx.Response(
                200,
                json={
                    "type": "WrongType",
                    "features": [],
                },
            ),
        ]

        for index, response in enumerate(responses):
            with self.subTest(response=index):
                self.client.post.return_value = response

                self.assert_service_error("invalid_response")

    def test_empty_features_are_not_treated_as_a_match(self):
        result = match_location_samples(self.request)

        self.assertEqual(result["type"], "FeatureCollection")
        self.assertEqual(result["features"], [])

    def test_valid_geometry_is_returned_without_extra_fields(self):
        self.client.post.return_value = httpx.Response(
            200,
            json={
                "type": "FeatureCollection",
                "provider_debug": "discard this field",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {
                            "distance": 48,
                            "waypoints": [],
                            "legs": [],
                        },
                        "geometry": {
                            "type": "MultiLineString",
                            "coordinates": [
                                [
                                    [85.8918, 26.1542],
                                    [85.8920, 26.1546],
                                ]
                            ],
                        },
                    }
                ],
            },
        )

        result = match_location_samples(self.request)

        self.assertEqual(len(result["features"]), 1)
        self.assertNotIn("provider_debug", result)
        self.assertEqual(
            result["features"][0]["geometry"]["coordinates"][0][0],
            [85.8918, 26.1542],
        )

    def test_malformed_route_features_are_rejected(self):
        invalid_features = [
            {"type": "Feature"},
            {
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [
                        [
                            [85.8918, 26.1542],
                            [181, 26.1546],
                        ]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [
                        [[85.8918, 26.1542]]
                    ],
                },
            },
        ]

        for index, feature in enumerate(invalid_features):
            with self.subTest(feature=index):
                self.client.post.return_value = httpx.Response(
                    200,
                    json={
                        "type": "FeatureCollection",
                        "features": [feature],
                    },
                )

                self.assert_service_error("invalid_response")


if __name__ == "__main__":
    unittest.main()
