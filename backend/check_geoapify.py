import os
from pathlib import Path

import httpx
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def main():
    api_key = os.getenv("GEOAPIFY_API_KEY", "").strip()

    if not api_key:
        print("GEOAPIFY_API_KEY is missing from backend/.env")
        return 1

    # Synthetic points near Darbhanga.
    # These are not a recorded journey or verified road locations.
    payload = {
        "mode": "drive",
        "waypoints": [
            {"location": [85.8918, 26.1542]},
            {"location": [85.8920, 26.1546]},
            {"location": [85.8922, 26.1550]},
        ],
        "geocode_step_address": False,
        "lookup_step_osmtags": False,
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                "https://api.geoapify.com/v1/mapmatching",
                params={"apiKey": api_key},
                json=payload,
            )
    except httpx.RequestError as error:
        print(
            "Could not reach Geoapify "
            f"({type(error).__name__})."
        )
        print("Check your internet connection and retry later.")
        return 1

    print(f"HTTP status: {response.status_code}")

    if response.status_code != 200:
        messages = {
            400: "The provider rejected the request format.",
            401: "Check your Geoapify API key.",
            403: "Check your API key permissions and restrictions.",
            429: "API usage or rate limit reached. Do not retry repeatedly.",
        }

        print(
            messages.get(
                response.status_code,
                "The provider did not return a successful response.",
            )
        )
        return 1

    try:
        data = response.json()
    except ValueError:
        print("The provider returned an unreadable JSON response.")
        return 1

    if (
        not isinstance(data, dict)
        or data.get("type") != "FeatureCollection"
        or not isinstance(data.get("features"), list)
    ):
        print("Unexpected response structure.")
        return 1

    features = data["features"]

    print("Success: received a Geoapify FeatureCollection.")
    print(f"Returned features: {len(features)}")

    if not features:
        print("No route geometry returned for these synthetic points.")
        print("This does not establish coverage or matching accuracy.")
        return 0

    for index, feature in enumerate(features, start=1):
        properties = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        waypoints = properties.get("waypoints") or []

        print(f"Feature {index}:")
        print(f"  Geometry type: {geometry.get('type', 'Unavailable')}")
        print(f"  Returned waypoint records: {len(waypoints)}")

        for point_index, waypoint in enumerate(waypoints, start=1):
            print(
                f"  Point {point_index}: "
                f"type={waypoint.get('match_type', 'Unavailable')}, "
                f"snap distance={waypoint.get('match_distance', 'Unavailable')} m"
            )

    print("Matching provider: Geoapify; road data: OpenStreetMap.")
    print("Connection test only; road-matching quality is not validated.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())