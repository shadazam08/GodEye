import unittest
from copy import deepcopy

from schemas import MapMatchRequest, ProviderMatchResponse
from services.match_validation import validate_match_links


class MatchValidationTests(unittest.TestCase):
    def setUp(self):
        self.request = MapMatchRequest.model_validate({
            "samples": [
                {
                    "latitude": 26.1542,
                    "longitude": 85.8918,
                    "timestamp": "2026-11-23T04:30:00Z",
                    "accuracy": 10,
                },
                {
                    "latitude": 26.1546,
                    "longitude": 85.8920,
                    "timestamp": "2026-11-23T04:30:10Z",
                    "accuracy": 12,
                },
            ],
        })

        coordinates = [
            [85.8918, 26.1542],
            [85.8920, 26.1546],
        ]

        self.data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "MultiLineString",
                        "coordinates": [deepcopy(coordinates)],
                    },
                    "properties": {
                        "waypoints": [
                            {
                                "original_index": index,
                                "original_location": point,
                                "location": list(point),
                                "match_type": "matched",
                                "match_distance": 0,
                                "leg_index": 0,
                                "step_index": 0,
                            }
                            for index, point in enumerate(coordinates)
                        ],
                        "legs": [
                            {
                                "steps": [
                                    {
                                        "from_index": 0,
                                        "to_index": 1,
                                        "osm_way_id": 123,
                                    }
                                ]
                            }
                        ],
                    },
                }
            ],
        }

    def validate_data(self, data):
        response = ProviderMatchResponse.model_validate(data)
        validate_match_links(self.request, response)

    def test_consistent_response_is_accepted(self):
        self.validate_data(self.data)

    def test_invalid_original_sample_links_are_rejected(self):
        for case in ("missing_index", "duplicate_index", "wrong_location"):
            with self.subTest(case=case):
                data = deepcopy(self.data)
                points = data["features"][0]["properties"]["waypoints"]

                if case == "missing_index":
                    points[0]["original_index"] = 99
                elif case == "duplicate_index":
                    points[1]["original_index"] = 0
                else:
                    points[0]["original_location"] = [85.9, 26.2]

                with self.assertRaises(ValueError):
                    self.validate_data(data)

    def test_invalid_geometry_links_are_rejected(self):
        for case in ("missing_point", "leg_count"):
            with self.subTest(case=case):
                data = deepcopy(self.data)
                feature = data["features"][0]

                if case == "missing_point":
                    feature["properties"]["legs"][0]["steps"][0][
                        "to_index"
                    ] = 2
                else:
                    feature["geometry"]["coordinates"].append(
                        deepcopy(feature["geometry"]["coordinates"][0])
                    )

                with self.assertRaises(ValueError):
                    self.validate_data(data)

    def test_invalid_waypoint_road_references_are_rejected(self):
        for case in ("missing_leg", "missing_step", "incomplete_reference"):
            with self.subTest(case=case):
                data = deepcopy(self.data)
                point = data["features"][0]["properties"]["waypoints"][0]

                if case == "missing_leg":
                    point["leg_index"] = 99
                elif case == "missing_step":
                    point["step_index"] = 99
                else:
                    point["leg_index"] = None

                with self.assertRaises(ValueError):
                    self.validate_data(data)

    def test_matched_points_require_location_and_distance(self):
        for field in ("location", "match_distance"):
            with self.subTest(field=field):
                data = deepcopy(self.data)
                point = data["features"][0]["properties"]["waypoints"][0]
                point[field] = None

                with self.assertRaises(ValueError):
                    self.validate_data(data)

    def test_absent_road_references_and_empty_results_are_allowed(self):
        data = deepcopy(self.data)

        for point in data["features"][0]["properties"]["waypoints"]:
            point["leg_index"] = None
            point["step_index"] = None

        # Accepted as incomplete metadata, not confirmed road identity.
        self.validate_data(data)

        self.validate_data({
            "type": "FeatureCollection",
            "features": [],
        })


if __name__ == "__main__":
    unittest.main()