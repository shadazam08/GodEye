import os
from datetime import timezone
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from pydantic import ValidationError
from services.match_validation import validate_match_links
from schemas import MapMatchRequest, ProviderMatchResponse


BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

GEOAPIFY_MATCHING_URL = "https://api.geoapify.com/v1/mapmatching"


class MapMatchingError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def match_location_samples(
    request: MapMatchRequest,
) -> dict[str, Any]:
    api_key = os.getenv("GEOAPIFY_API_KEY", "").strip()

    if not api_key:
        raise MapMatchingError(
            "not_configured",
            "Road matching is not configured.",
        )

    waypoints = []

    for sample in request.samples:
        timestamp = (
            sample.timestamp
            .astimezone(timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z")
        )

        waypoint = {
            "location": [
                sample.longitude,
                sample.latitude,
            ],
            "timestamp": timestamp,
        }

        if sample.heading is not None:
            waypoint["bearing"] = sample.heading

        waypoints.append(waypoint)

    payload = {
        "mode": request.mode,
        "waypoints": waypoints,
        "geocode_step_address": False,
        "lookup_step_osmtags": False,
    }

    try:
        with httpx.Client(
            timeout=httpx.Timeout(20.0, connect=5.0),
            follow_redirects=False,
        ) as client:
            response = client.post(
                GEOAPIFY_MATCHING_URL,
                params={"apiKey": api_key},
                json=payload,
            )
    except httpx.TimeoutException:
        raise MapMatchingError(
            "timeout",
            "Road-matching service timed out.",
        ) from None
    except httpx.RequestError:
        raise MapMatchingError(
            "network_error",
            "Could not reach the road-matching service.",
        ) from None

    if response.status_code in (401, 403):
        raise MapMatchingError(
            "provider_access_error",
            "Road-matching provider access failed.",
        )

    if response.status_code == 429:
        raise MapMatchingError(
            "quota_or_rate_limit",
            "Road matching is temporarily limited. Try again later.",
        )

    if response.status_code != 200:
        raise MapMatchingError(
            "provider_error",
            "Road-matching provider could not complete the request.",
        )

    try:
        data = response.json()
    except ValueError:
        raise MapMatchingError(
            "invalid_response",
            "Road-matching provider returned unreadable data.",
        ) from None

    try:
        validated_response = ProviderMatchResponse.model_validate(data)
        validate_match_links(request, validated_response)
    except (ValidationError, ValueError):
        raise MapMatchingError(
            "invalid_response",
            "Road-matching provider returned invalid or inconsistent route data.",
        ) from None

    return validated_response.model_dump(mode="json")