import os
from typing import Annotated
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy import select
from database import get_db
from models import Report, ReviewEvent
from schemas import ReportCreate, ReportRead, ReportReview, ReviewEventRead
from typing import Literal
from security import require_reviewer
from uuid import UUID


app = FastAPI(
    title="GodEye API",
    description="Backend for the GodEye road awareness platform.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)

DatabaseSession = Annotated[Session, Depends(get_db)]


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "GodEye API",
    }


@app.post(
    "/api/reports",
    response_model=ReportRead,
    status_code=status.HTTP_201_CREATED,
)
def create_report(
    payload: ReportCreate,
    db: DatabaseSession,
):
    try:
        with db.begin():
            report = Report(**payload.model_dump())

            db.add(report)
            db.flush()
            db.refresh(report)

            result = ReportRead.model_validate(report)

        return result

    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not save the report. Please try again later.",
        ) from None

@app.get(
    "/api/hazards",
    response_model=list[ReportRead],
)
def list_verified_hazards(
    db: DatabaseSession,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    statement = (
        select(Report)
        .where(Report.status == "verified")
        .order_by(
            Report.created_at.desc(),
            Report.id.desc(),
        )
        .limit(limit)
        .offset(offset)
    )

    try:
        reports = db.scalars(statement).all()

        return [
            ReportRead.model_validate(report)
            for report in reports
        ]

    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not load road hazards. Please try again later.",
        ) from None

@app.get(
    "/api/admin/reports",
    response_model=list[ReportRead],
    dependencies=[Depends(require_reviewer)],
)
def list_reports_for_review(
    db: DatabaseSession,
    review_status: Literal[
        "pending", "verified", "rejected"
    ] = "pending",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    statement = (
        select(Report)
        .where(Report.status == review_status)
        .order_by(
            Report.created_at.asc(),
            Report.id.asc(),
        )
        .limit(limit)
        .offset(offset)
    )

    try:
        reports = db.scalars(statement).all()

        return [
            ReportRead.model_validate(report)
            for report in reports
        ]

    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not load reports. Please try again later.",
        ) from None

@app.patch(
    "/api/admin/reports/{report_id}/review",
    response_model=ReportRead,
    dependencies=[Depends(require_reviewer)],
)
def review_report(
    report_id: UUID,
    payload: ReportReview,
    db: DatabaseSession,
):
    reviewer_label = os.getenv("REVIEWER_LABEL", "").strip()

    if not reviewer_label or len(reviewer_label) > 100:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Reviewer label is not configured correctly.",
        )

    try:
        with db.begin():
            statement = (
                select(Report)
                .where(Report.id == report_id)
                .with_for_update()
            )

            report = db.scalar(statement)

            if report is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Report not found.",
                )

            # Repeated decisions do not create duplicate history.
            if report.status == payload.status:
                return ReportRead.model_validate(report)

            if report.status != "pending":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "This report has already been reviewed. "
                        "Refresh the report list."
                    ),
                )

            review_event = ReviewEvent(
                report_id=report.id,
                previous_status=report.status,
                new_status=payload.status,
                reviewer_label=reviewer_label,
                reason=payload.reason,
            )

            report.status = payload.status
            db.add(review_event)

            db.flush()

            result = ReportRead.model_validate(report)

        return result

    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not save the review. Please try again later.",
        ) from None

@app.get(
    "/api/admin/reports/{report_id}/history",
    response_model=list[ReviewEventRead],
    dependencies=[Depends(require_reviewer)],
)
def get_report_history(
    report_id: UUID,
    db: DatabaseSession,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    try:
        report = db.get(Report, report_id)

        if report is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found.",
            )

        statement = (
            select(ReviewEvent)
            .where(ReviewEvent.report_id == report_id)
            .order_by(
                ReviewEvent.created_at.asc(),
                ReviewEvent.id.asc(),
            )
            .limit(limit)
            .offset(offset)
        )

        events = db.scalars(statement).all()

        return [
            ReviewEventRead.model_validate(event)
            for event in events
        ]

    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not load review history. Please try again later.",
        ) from None


