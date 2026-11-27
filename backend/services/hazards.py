import base64
import binascii
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, ValidationError
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from models import Report
from schemas import HazardAreaQuery, HazardBounds, HazardPage, ReportRead


class HazardCursorError(ValueError):
    pass


class _HazardCursor(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: Literal[1]
    bounds: HazardBounds
    created_at: AwareDatetime
    report_id: UUID


def _decode_cursor(value: str, bounds: HazardBounds) -> _HazardCursor:
    try:
        # Reject malformed, oversized and wrong-area cursors before querying.
        if not 1 <= len(value) <= 512:
            raise ValueError

        payload = base64.b64decode(
            value + "=" * (-len(value) % 4),
            altchars=b"-_",
            validate=True,
        )
        cursor = _HazardCursor.model_validate_json(payload)

        if cursor.bounds != bounds:
            raise ValueError

        return cursor
    except (ValueError, UnicodeError, binascii.Error, ValidationError):
        raise HazardCursorError("Invalid road report page. Reload the map.") from None


def list_area_hazards(db: Session, query: HazardAreaQuery) -> HazardPage:
    bounds = HazardBounds(
        south=query.south,
        north=query.north,
        west=query.west,
        east=query.east,
    )
    cursor = _decode_cursor(query.cursor, bounds) if query.cursor else None

    longitude_filter = (
        and_(Report.longitude >= bounds.west, Report.longitude <= bounds.east)
        if bounds.west < bounds.east
        else or_(Report.longitude >= bounds.west, Report.longitude <= bounds.east)
    )
    statement = select(Report).where(
        Report.status == "verified",
        Report.repaired_at.is_(None),
        Report.latitude >= bounds.south,
        Report.latitude <= bounds.north,
        longitude_filter,
    )

    if cursor:
        # Keyset pagination remains stable when earlier rows are repaired or
        # removed. Offset pagination can skip a still-active hazard in that case.
        statement = statement.where(or_(
            Report.created_at < cursor.created_at,
            and_(
                Report.created_at == cursor.created_at,
                Report.id < cursor.report_id,
            ),
        ))

    statement = statement.order_by(
        Report.created_at.desc(),
        Report.id.desc(),
    ).limit(query.limit + 1)
    reports = db.scalars(statement).all()
    items = reports[:query.limit]
    next_cursor = None

    if len(reports) > query.limit:
        last = items[-1]
        payload = _HazardCursor(
            version=1,
            bounds=bounds,
            created_at=last.created_at,
            report_id=last.id,
        ).model_dump_json().encode("utf-8")
        next_cursor = base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")

    return HazardPage(
        items=[ReportRead.model_validate(report) for report in items],
        next_cursor=next_cursor,
    )
