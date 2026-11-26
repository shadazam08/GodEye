import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from schemas import DestinationRead


BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

SEARCH_URL = "https://api.geoapify.com/v1/geocode/search"


class DestinationSearchError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class ProviderPlace(BaseModel):
    model_config = ConfigDict(
        extra="ignore",
        strict=True,
        allow_inf_nan=False,
        str_strip_whitespace=True,
    )

    place_id: str = Field(min_length=1)
    formatted: str = Field(min_length=1, max_length=1000)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class ProviderSearchResponse(BaseModel):
    model_config = ConfigDict(
        extra="ignore",
        strict=True,
    )

    results: list[ProviderPlace] = Field(max_length=5)


def search_destinations(query: str) -> list[DestinationRead]:
    query = query.strip()

    if not 3 <= len(query) <= 120:
        raise DestinationSearchError(
            "invalid_query",
            "Enter a destination of 3 to 120 characters.",
        )

    api_key = os.getenv("GEOAPIFY_API_KEY", "").strip()

    if not api_key:
        raise DestinationSearchError(
            "not_configured",
            "Destination search is not configured.",
        )

    try:
        with httpx.Client(
            timeout=httpx.Timeout(15.0, connect=5.0),
            follow_redirects=False,
        ) as client:
            response = client.get(
                SEARCH_URL,
                params={
                    "text": query,
                    "format": "json",
                    "limit": 5,
                    "lang": "en",
                    "filter": "countrycode:in",
                    "bias": "proximity:85.8918,26.1542",
                    "apiKey": api_key,
                },
            )

    except httpx.TimeoutException:
        raise DestinationSearchError(
            "timeout",
            "Destination search timed out. Please try again.",
        ) from None

    except httpx.RequestError:
        raise DestinationSearchError(
            "network_error",
            "Could not reach destination search.",
        ) from None

    if response.status_code == 429:
        raise DestinationSearchError(
            "rate_limited",
            "Destination search is temporarily limited. Try later.",
        )

    if response.status_code in (401, 403):
        raise DestinationSearchError(
            "provider_access_error",
            "Destination search provider access failed.",
        )

    if response.status_code != 200:
        raise DestinationSearchError(
            "provider_error",
            "Destination search is temporarily unavailable.",
        )

    try:
        validated = ProviderSearchResponse.model_validate(
            response.json()
        )

    except (ValueError, ValidationError):
        raise DestinationSearchError(
            "invalid_response",
            "Destination search returned invalid data.",
        ) from None

    return [
        DestinationRead(
            place_id=place.place_id,
            label=place.formatted,
            latitude=place.lat,
            longitude=place.lon,
        )
        for place in validated.results
    ]