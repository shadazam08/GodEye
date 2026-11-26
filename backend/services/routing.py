import os
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from schemas import RouteGeometry, RouteRead, RouteRequest


BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

ROUTING_URL = "https://api.geoapify.com/v1/routing"


class RoutingError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class ProviderRouteProperties(BaseModel):
    model_config = ConfigDict(
        extra="ignore",
        allow_inf_nan=False,
    )

    mode: Literal["drive", "motorcycle"]
    distance: float = Field(ge=0)
    time: float = Field(ge=0)
    distance_units: Literal["meters"]


class ProviderRouteFeature(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: Literal["Feature"]
    properties: ProviderRouteProperties
    geometry: RouteGeometry


class ProviderRouteResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: Literal["FeatureCollection"]

    features: list[ProviderRouteFeature] = Field(
        max_length=1,
    )


def calculate_route(request: RouteRequest) -> RouteRead:
    api_key = os.getenv("GEOAPIFY_API_KEY", "").strip()

    if not api_key:
        raise RoutingError(
            "not_configured",
            "Route planning is not configured.",
        )

    waypoints = (
        f"{request.start.latitude},"
        f"{request.start.longitude}|"
        f"{request.destination.latitude},"
        f"{request.destination.longitude}"
    )

    try:
        with httpx.Client(
            timeout=httpx.Timeout(20.0, connect=5.0),
            follow_redirects=False,
        ) as client:
            response = client.get(
                ROUTING_URL,
                params={
                    "waypoints": waypoints,
                    "mode": request.mode,
                    "format": "geojson",
                    "units": "metric",
                    "apiKey": api_key,
                },
            )

    except httpx.TimeoutException:
        raise RoutingError(
            "timeout",
            "Route planning timed out. Please try again.",
        ) from None

    except httpx.RequestError:
        raise RoutingError(
            "network_error",
            "Could not reach the route-planning service.",
        ) from None

    if response.status_code == 429:
        raise RoutingError(
            "rate_limited",
            "Route planning is temporarily limited. Try later.",
        )

    if response.status_code in (401, 403):
        raise RoutingError(
            "provider_access_error",
            "Route-planning provider access failed.",
        )

    if response.status_code != 200:
        raise RoutingError(
            "provider_error",
            "A route could not be calculated. Try another destination.",
        )

    try:
        validated = ProviderRouteResponse.model_validate(
            response.json()
        )

    except (ValueError, ValidationError):
        raise RoutingError(
            "invalid_response",
            "The route-planning service returned invalid data.",
        ) from None

    if not validated.features:
        raise RoutingError(
            "no_route",
            "No road route was found for these locations.",
        )

    feature = validated.features[0]

    if feature.properties.mode != request.mode:
        raise RoutingError(
            "invalid_response",
            "The returned route uses an unexpected travel mode.",
        )

    # Only return the fields needed by our frontend.
    # Do not forward the provider's request metadata.
    return RouteRead(
        mode=request.mode,
        distance_m=feature.properties.distance,
        duration_s=feature.properties.time,
        geometry=feature.geometry,
        attribution="Routing: Geoapify; road data: OpenStreetMap.",
    )