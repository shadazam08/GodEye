from datetime import datetime
from uuid import UUID

from typing import Annotated, Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)


class ReportCreate(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    title: str = Field(
        min_length=5,
        max_length=120,
        description="A short title describing the road damage.",
    )

    description: str = Field(
        min_length=10,
        max_length=2000,
        description="Details that can help a reviewer assess the report.",
    )

    location_name: str = Field(
        min_length=3,
        max_length=200,
        description="Road name or a nearby landmark.",
    )

    latitude: float = Field(
        ge=-90,
        le=90,
        description="Latitude of the reported pothole.",
    )

    longitude: float = Field(
        ge=-180,
        le=180,
        description="Longitude of the reported pothole.",
    )

    severity: Literal["low", "medium", "high"] = Field(
        description="Reporter-estimated severity, subject to review.",
    )


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    location_name: str
    latitude: float
    longitude: float
    severity: Literal["low", "medium", "high"]
    status: Literal["pending", "verified", "rejected"]
    created_at: datetime
    repaired_at: datetime | None = None


class ReportReview(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    status: Literal["verified", "rejected"]

    reason: str = Field(
        min_length=10,
        max_length=2000,
        description="Explain the evidence behind this review decision.",
    )


class ReviewEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    report_id: UUID
    reviewer_uid: str | None = None
    previous_status: Literal["pending", "verified", "rejected"]
    new_status: Literal["verified", "rejected"]
    reviewer_label: str
    reason: str
    created_at: datetime


class LocationSample(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        allow_inf_nan=False,
    )

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)

    timestamp: AwareDatetime

    accuracy: float = Field(
        ge=0,
        description="Browser-reported accuracy radius in metres.",
    )

    heading: float | None = Field(
        default=None,
        ge=0,
        lt=360,
        description="Degrees clockwise from north, when available.",
    )


class MapMatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["drive", "motorcycle"] = "drive"

    samples: list[LocationSample] = Field(
        min_length=2,
        max_length=50,
    )

    @model_validator(mode="after")
    def check_sample_order(self) -> "MapMatchRequest":
        for previous, current in zip(
            self.samples,
            self.samples[1:],
        ):
            if current.timestamp <= previous.timestamp:
                raise ValueError(
                    "Sample timestamps must be strictly increasing."
                )

        return self


# GeoJSON uses longitude first, then latitude.
GeoJsonCoordinate = tuple[
    Annotated[
        float,
        Field(ge=-180, le=180, allow_inf_nan=False),
    ],
    Annotated[
        float,
        Field(ge=-90, le=90, allow_inf_nan=False),
    ],
]


class MatchingResponseBase(BaseModel):
    model_config = ConfigDict(
        extra="ignore",
        allow_inf_nan=False,
    )


class MatchedWaypoint(MatchingResponseBase):
    original_index: int = Field(ge=0)

    original_location: GeoJsonCoordinate
    location: GeoJsonCoordinate | None = None

    match_type: Literal[
        "matched",
        "unmatched",
        "interpolated",
        "merged",
    ]

    match_distance: float | None = Field(
        default=None,
        ge=0,
    )

    leg_index: int | None = Field(default=None, ge=0)
    step_index: int | None = Field(default=None, ge=0)


class MatchedRoadStep(MatchingResponseBase):
    from_index: int = Field(ge=0)
    to_index: int = Field(ge=0)

    osm_way_id: int | str | None = None
    name: str | None = None

    bridge: bool | None = None
    tunnel: bool | None = None

    @model_validator(mode="after")
    def check_index_order(self) -> "MatchedRoadStep":
        if self.to_index < self.from_index:
            raise ValueError(
                "Road step end index must not precede its start."
            )

        return self


class MatchedLeg(MatchingResponseBase):
    steps: list[MatchedRoadStep] = Field(
        default_factory=list,
    )


class MatchedRouteProperties(MatchingResponseBase):
    waypoints: list[MatchedWaypoint] = Field(
        default_factory=list,
    )

    legs: list[MatchedLeg] = Field(
        default_factory=list,
    )

    distance: float | None = Field(default=None, ge=0)


class MatchedRouteGeometry(MatchingResponseBase):
    type: Literal["MultiLineString"]

    coordinates: Annotated[
        list[
            Annotated[
                list[GeoJsonCoordinate],
                Field(min_length=2),
            ]
        ],
        Field(min_length=1),
    ]


class MatchedRouteFeature(MatchingResponseBase):
    type: Literal["Feature"]
    properties: MatchedRouteProperties
    geometry: MatchedRouteGeometry


class ProviderMatchResponse(MatchingResponseBase):
    type: Literal["FeatureCollection"]
    features: list[MatchedRouteFeature]


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uid: str
    email: str | None
    email_verified: bool
    name: str | None
    role: Literal["user", "admin"]


class ReportPhotoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    report_id: UUID
    width: int
    height: int
    byte_size: int
    created_at: datetime


class ReportPhotoPreview(BaseModel):
    photo_id: UUID
    url: str
    expires_at: int


class RepairConfirmationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    report_id: UUID
    photo_id: UUID
    note: str
    created_at: datetime
