import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
    Uuid,
    func,
    Integer,
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Report(Base):
    __tablename__ = "reports"

    __table_args__ = (
        CheckConstraint(
            "latitude >= -90 AND latitude <= 90",
            name="ck_reports_latitude",
        ),
        CheckConstraint(
            "longitude >= -180 AND longitude <= 180",
            name="ck_reports_longitude",
        ),
        CheckConstraint(
            "severity IN ('low', 'medium', 'high')",
            name="ck_reports_severity",
        ),
        CheckConstraint(
            "status IN ('pending', 'verified', 'rejected')",
            name="ck_reports_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    reporter_uid: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    location_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    latitude: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    longitude: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    severity: Mapped[str] = mapped_column(
        String(6),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(12),
        nullable=False,
        server_default="pending",
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    repaired_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class ReviewEvent(Base):
    __tablename__ = "review_events"

    __table_args__ = (
        CheckConstraint(
            "previous_status IN ('pending', 'verified', 'rejected')",
            name="ck_review_events_previous_status",
        ),
        CheckConstraint(
            "new_status IN ('verified', 'rejected')",
            name="ck_review_events_new_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    report_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("reports.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    previous_status: Mapped[str] = mapped_column(
        String(12),
        nullable=False,
    )

    new_status: Mapped[str] = mapped_column(
        String(12),
        nullable=False,
    )

    reviewer_label: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    reviewer_uid: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
        index=True,
    )

    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class ReportPhoto(Base):
    __tablename__ = "report_photos"

    __table_args__ = (
        CheckConstraint(
            "width > 0 AND height > 0",
            name="ck_report_photos_dimensions",
        ),
        CheckConstraint(
            "byte_size > 0",
            name="ck_report_photos_byte_size",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    report_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("reports.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    uploaded_by_uid: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
    )

    public_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
    )

    asset_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
    )

    width: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    height: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    byte_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class AppUser(Base):
    __tablename__ = "users"

    __table_args__ = (
        CheckConstraint(
            "role IN ('user', 'admin')",
            name="ck_users_role",
        ),
    )

    uid: Mapped[str] = mapped_column(
        String(128),
        primary_key=True,
    )

    email: Mapped[str | None] = mapped_column(
        String(320),
        nullable=True,
    )

    display_name: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    role: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="user",
        server_default="user",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

class RepairConfirmation(Base):
    __tablename__ = "repair_confirmations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    report_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("reports.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )

    photo_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("report_photos.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )

    confirmed_by_uid: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
    )

    note: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )