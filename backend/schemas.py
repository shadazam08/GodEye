from datetime import datetime
from uuid import UUID

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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
    previous_status: Literal["pending", "verified", "rejected"]
    new_status: Literal["verified", "rejected"]
    reviewer_label: str
    reason: str
    created_at: datetime