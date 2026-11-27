import logging
import os
from typing import Annotated, Literal
from uuid import UUID, uuid4
from services.accounts import sync_account_role
from datetime import datetime, timezone
from fastapi import (
    Depends,
    FastAPI,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    Form,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from pydantic import ValidationError
from database import get_db
from models import Report, ReportPhoto, ReviewEvent
from schemas import (
    MapMatchRequest,
    ProviderMatchResponse,
    ReportCreate,
    ReportPhotoRead,
    ReportRead,
    ReportReview,
    ReportPhotoPreview,
    ReviewEventRead,
    UserRead,
    RouteRequest,
    RouteRead,
    DestinationRead,
    RepairConfirmationRead,
    HazardAreaQuery,
    HazardPage,
)
from security import require_reviewer
from user_auth import (
    CurrentUser,
    require_authenticated_user,
    require_verified_user,
)

from services.map_matching import (
    MapMatchingError,
    match_location_samples,
)
from services.photo_storage import (
    PhotoStorageError,
    delete_confirmed_report_photo,
    upload_report_photo,
    create_report_photo_preview,
)
from services.photo_validation import (
    MAX_UPLOAD_BYTES,
    PhotoValidationError,
)
from models import (
    Report,
    ReportPhoto,
    ReviewEvent,
    RepairConfirmation,
)

from services.destination_search import (
    DestinationSearchError,
    search_destinations,
)

from services.routing import (
    RoutingError,
    calculate_route,
)
from services.hazards import HazardCursorError, list_area_hazards

logger = logging.getLogger(__name__)

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
        "https://god-eye-eight.vercel.app",
        "https://god-3i6k6ok3o-shad-azams.vercel.app",
        "https://localhost",
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


@app.get("/api/ready")
def readiness_check(response: Response, db: DatabaseSession):
    response.headers["Cache-Control"] = "no-store"

    try:
        db.execute(text("SELECT 1")).scalar_one()
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database readiness could not be confirmed.",
            headers={"Cache-Control": "no-store"},
        ) from None

    return {"status": "ok", "service": "GodEye API"}


@app.post(
    "/api/reports",
    response_model=ReportRead,
    status_code=status.HTTP_201_CREATED,
)
def create_report(
    db: DatabaseSession,
    user: Annotated[
        CurrentUser,
        Depends(require_verified_user),
    ],
    payload: Annotated[
        str,
        Form(max_length=12000),
    ],
    file: Annotated[UploadFile, File()],
):
    # Report details arrive as JSON text inside the form.
    try:
        report_data = ReportCreate.model_validate_json(payload)

    except ValidationError:
        raise HTTPException(
            status_code=422,
            detail=(
                "Report details are invalid. "
                "Check the required fields and location."
            ),
        ) from None

    # A required File parameter blocks requests without a photo.
    try:
        raw = file.file.read(MAX_UPLOAD_BYTES + 1)

    except OSError:
        raise HTTPException(
            status_code=400,
            detail="Could not read the selected photo.",
        ) from None

    if not raw:
        raise HTTPException(
            status_code=400,
            detail="At least one photo is required.",
        )

    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Photo must be 3 MiB or smaller.",
        )

    report_id = uuid4()
    photo_id = uuid4()

    # This service validates the actual image contents,
    # processes the image and uploads an authenticated asset.
    try:
        stored = upload_report_photo(raw, photo_id)

    except PhotoValidationError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from None

    except PhotoStorageError:
        raise HTTPException(
            status_code=503,
            detail=(
                "Photo upload could not be confirmed. "
                "The report has not been submitted."
            ),
        ) from None

    commit_attempted = False

    try:
        with db.begin():
            report = Report(
                id=report_id,
                **report_data.model_dump(),
                reporter_uid=user.uid,
            )

            db.add(report)
            db.flush()

            photo = ReportPhoto(
                id=photo_id,
                report_id=report.id,
                uploaded_by_uid=user.uid,
                public_id=stored.public_id,
                asset_id=stored.asset_id,
                width=stored.width,
                height=stored.height,
                byte_size=stored.byte_count,
            )

            db.add(photo)
            db.flush()
            db.refresh(report)

            result = ReportRead.model_validate(report)

            # Both database records commit together.
            # A connection failure during commit can leave
            # the outcome uncertain.
            commit_attempted = True

        return result

    except SQLAlchemyError:
        logger.warning(
            "Report save could not be confirmed: "
            "report_id=%s photo_id=%s commit_attempted=%s",
            report_id,
            photo_id,
            commit_attempted,
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Report submission could not be confirmed. "
                "Check My Reports before submitting again."
            ),
        ) from None

    finally:
        # If the transaction failed before commit, remove
        # the confirmed storage upload.
        # After an uncertain commit, retain the image because
        # the report and photo record may already be saved.
        if not commit_attempted:
            try:
                delete_confirmed_report_photo(
                    photo_id,
                    stored,
                )

            except PhotoStorageError:
                logger.warning(
                    "Report photo cleanup needs follow-up: "
                    "report_id=%s photo_id=%s",
                    report_id,
                    photo_id,
                )


@app.post(
    "/api/reports/{report_id}/photos",
    response_model=ReportPhotoRead,
    status_code=status.HTTP_201_CREATED,
)
def add_report_photo(
    report_id: UUID,
    db: DatabaseSession,
    user: Annotated[
        CurrentUser,
        Depends(require_verified_user),
    ],
    file: Annotated[UploadFile, File()],
):
    # Read at most the permitted size plus one byte.
    try:
        raw = file.file.read(MAX_UPLOAD_BYTES + 1)
    except OSError:
        raise HTTPException(
            status_code=400,
            detail="Could not read the uploaded photo.",
        ) from None

    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Photo must be 3 MiB or smaller.",
        )

    photo_id = uuid4()
    stored = None
    commit_attempted = False

    try:
        with db.begin():
            # The report lock serializes uploads for this report.
            # It also prevents its review status from changing
            # while this transaction is adding photo evidence.
            report = db.scalar(
                select(Report)
                .where(
                    Report.id == report_id,
                    Report.reporter_uid == user.uid,
                )
                .with_for_update()
            )

            if report is None:
                raise HTTPException(
                    status_code=404,
                    detail="Report not found.",
                )

            if report.status != "pending":
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Photos can only be added "
                        "to pending reports."
                    ),
                )

            photo_count = db.scalar(
                select(func.count())
                .select_from(ReportPhoto)
                .where(
                    ReportPhoto.report_id == report_id
                )
            )

            if photo_count >= 3:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "A report can have a maximum "
                        "of 3 photos."
                    ),
                )

            try:
                stored = upload_report_photo(
                    raw,
                    photo_id,
                )
            except PhotoValidationError as error:
                raise HTTPException(
                    status_code=400,
                    detail=str(error),
                ) from None
            except PhotoStorageError:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Photo upload could not be confirmed. "
                        "Please check your report before "
                        "trying again."
                    ),
                ) from None

            photo = ReportPhoto(
                id=photo_id,
                report_id=report_id,
                uploaded_by_uid=user.uid,
                public_id=stored.public_id,
                asset_id=stored.asset_id,
                width=stored.width,
                height=stored.height,
                byte_size=stored.byte_count,
            )

            db.add(photo)
            db.flush()
            db.refresh(photo)

            result = ReportPhotoRead.model_validate(photo)

            # Exiting db.begin() now attempts the commit.
            # If the connection fails during commit, the
            # database may still have saved the record.
            commit_attempted = True

        return result

    except SQLAlchemyError:
        if commit_attempted:
            logger.warning(
                "Photo database commit outcome uncertain: "
                "photo_id=%s report_id=%s",
                photo_id,
                report_id,
            )

        raise HTTPException(
            status_code=503,
            detail=(
                "Photo save could not be confirmed. "
                "Please check your report before "
                "trying again."
            ),
        ) from None

    finally:
        # Only remove a confirmed upload if failure happened
        # before the database commit was attempted.
        if stored is not None and not commit_attempted:
            try:
                delete_confirmed_report_photo(
                    photo_id,
                    stored,
                )
            except PhotoStorageError:
                logger.warning(
                    "Photo cleanup needs follow-up: "
                    "photo_id=%s report_id=%s",
                    photo_id,
                    report_id,
                )


@app.get(
    "/api/reports/{report_id}/photos",
    response_model=list[ReportPhotoRead],
)
def list_my_report_photos(
    report_id: UUID,
    response: Response,
    db: DatabaseSession,
    user: Annotated[
        CurrentUser,
        Depends(require_authenticated_user),
    ],
):
    response.headers["Cache-Control"] = "no-store"

    try:
        report = db.scalar(
            select(Report)
            .where(
                Report.id == report_id,
                Report.reporter_uid == user.uid,
            )
        )

        if report is None:
            raise HTTPException(
                status_code=404,
                detail="Report not found.",
            )

        photos = db.scalars(
            select(ReportPhoto)
            .where(
                ReportPhoto.report_id == report_id
            )
            .order_by(
                ReportPhoto.created_at.asc(),
                ReportPhoto.id.asc(),
            )
        ).all()

        return [
            ReportPhotoRead.model_validate(photo)
            for photo in photos
        ]

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Could not load report photos.",
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
        .where(
            Report.status == "verified",
            Report.repaired_at.is_(None),
        )
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


@app.get("/api/hazards/area", response_model=HazardPage)
def list_verified_hazards_in_area(
    response: Response,
    db: DatabaseSession,
    query: Annotated[HazardAreaQuery, Query()],
):
    response.headers["Cache-Control"] = "no-store"

    try:
        return list_area_hazards(db, query)
    except HazardCursorError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
            headers={"Cache-Control": "no-store"},
        ) from None
    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Could not load road hazards. Please try again later.",
            headers={"Cache-Control": "no-store"},
        ) from None


@app.get(
    "/api/admin/reports",
    response_model=list[ReportRead],
)
def list_reports_for_review(
    response: Response,
    db: DatabaseSession,
    reviewer: Annotated[
        CurrentUser,
        Depends(require_reviewer),
    ],
    review_status: Literal[
        "pending", "verified", "rejected"
    ] = "pending",
    mine: bool = False,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    response.headers["Cache-Control"] = "no-store"

    statement = (
        select(Report)
        .where(Report.status == review_status)
    )

    if mine:
        # Identity comes from verified login, not a supplied UID.
        my_decision_exists = (
            select(ReviewEvent.id)
            .where(
                ReviewEvent.report_id == Report.id,
                ReviewEvent.reviewer_uid == reviewer.uid,
            )
            .exists()
        )

        statement = statement.where(my_decision_exists)

    if review_status == "pending":
        statement = statement.order_by(
            Report.created_at.asc(),
            Report.id.asc(),
        )
    else:
        statement = statement.order_by(
            Report.created_at.desc(),
            Report.id.desc(),
        )

    statement = statement.limit(limit).offset(offset)

    try:
        reports = db.scalars(statement).all()

        return [
            ReportRead.model_validate(report)
            for report in reports
        ]

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
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
    reviewer: Annotated[
        CurrentUser,
        Depends(require_reviewer),
    ],
):

    # reviewer_label = os.getenv("REVIEWER_LABEL", "").strip()
    reviewer_label = (
        reviewer.name or reviewer.email or "Admin"
    )[:100]

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
                reviewer_uid=reviewer.uid,
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


@app.post(
    "/api/admin/map-matching",
    response_model=ProviderMatchResponse,
    dependencies=[Depends(require_reviewer)],
)
def match_trace(payload: MapMatchRequest):
    try:
        return match_location_samples(payload)

    except MapMatchingError as error:
        error_statuses = {
            "not_configured": status.HTTP_503_SERVICE_UNAVAILABLE,
            "provider_access_error": status.HTTP_503_SERVICE_UNAVAILABLE,
            "quota_or_rate_limit": status.HTTP_503_SERVICE_UNAVAILABLE,
            "network_error": status.HTTP_503_SERVICE_UNAVAILABLE,
            "timeout": status.HTTP_504_GATEWAY_TIMEOUT,
            "provider_error": status.HTTP_502_BAD_GATEWAY,
            "invalid_response": status.HTTP_502_BAD_GATEWAY,
        }

        raise HTTPException(
            status_code=error_statuses.get(
                error.code,
                status.HTTP_502_BAD_GATEWAY,
            ),
            detail={
                "code": error.code,
                "message": str(error),
            },
        ) from None


@app.get(
    "/api/me",
    response_model=UserRead,
)
def get_current_user(
    response: Response,
    db: DatabaseSession,
    user: Annotated[
        CurrentUser,
        Depends(require_authenticated_user),
    ],
):
    response.headers["Cache-Control"] = "no-store"

    try:
        role = sync_account_role(db, user)

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail=(
                "Could not load your account. "
                "Please try again later."
            ),
        ) from None

    return UserRead(
        uid=user.uid,
        email=user.email,
        email_verified=user.email_verified,
        name=user.name,
        role=role,
    )


@app.get(
    "/api/my/reports",
    response_model=list[ReportRead],
)
def get_my_reports(
    response: Response,
    db: DatabaseSession,
    user: Annotated[
        CurrentUser,
        Depends(require_authenticated_user),
    ],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    response.headers["Cache-Control"] = "no-store"

    statement = (
        select(Report)
        .where(Report.reporter_uid == user.uid)
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
            detail="Could not load your reports. Please try again later.",
            headers={"Cache-Control": "no-store"},
        ) from None


@app.get(
    "/api/admin/reports/{report_id}/photos",
    response_model=list[ReportPhotoRead],
    dependencies=[Depends(require_reviewer)],
)
def list_review_report_photos(
    report_id: UUID,
    response: Response,
    db: DatabaseSession,
):
    response.headers["Cache-Control"] = "no-store"

    try:
        report = db.scalar(
            select(Report)
            .where(Report.id == report_id)
        )

        if report is None:
            raise HTTPException(
                status_code=404,
                detail="Report not found.",
            )

        photos = db.scalars(
            select(ReportPhoto)
            .where(
                ReportPhoto.report_id == report_id
            )
            .order_by(
                ReportPhoto.created_at.asc(),
                ReportPhoto.id.asc(),
            )
        ).all()

        return [
            ReportPhotoRead.model_validate(photo)
            for photo in photos
        ]

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Could not load report photos.",
        ) from None


def _build_report_photo_preview(
    photo: ReportPhoto,
) -> ReportPhotoPreview:
    try:
        url, expires_at = create_report_photo_preview(
            photo.id,
            photo.public_id,
        )
    except PhotoStorageError:
        raise HTTPException(
            status_code=503,
            detail="Photo preview is temporarily unavailable.",
        ) from None

    return ReportPhotoPreview(
        photo_id=photo.id,
        url=url,
        expires_at=expires_at,
    )


@app.get(
    "/api/reports/{report_id}/photos/{photo_id}/preview",
    response_model=ReportPhotoPreview,
)
def preview_my_report_photo(
    report_id: UUID,
    photo_id: UUID,
    response: Response,
    db: DatabaseSession,
    user: Annotated[
        CurrentUser,
        Depends(require_authenticated_user),
    ],
):
    response.headers["Cache-Control"] = "no-store"

    try:
        photo = db.scalar(
            select(ReportPhoto)
            .join(
                Report,
                Report.id == ReportPhoto.report_id,
            )
            .where(
                ReportPhoto.id == photo_id,
                ReportPhoto.report_id == report_id,
                Report.reporter_uid == user.uid,
            )
        )

        if photo is None:
            raise HTTPException(
                status_code=404,
                detail="Photo not found.",
            )

        return _build_report_photo_preview(photo)

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Could not load the photo preview.",
        ) from None


@app.get(
    "/api/admin/reports/{report_id}/photos/{photo_id}/preview",
    response_model=ReportPhotoPreview,
    dependencies=[Depends(require_reviewer)],
)
def preview_review_report_photo(
    report_id: UUID,
    photo_id: UUID,
    response: Response,
    db: DatabaseSession,
):
    response.headers["Cache-Control"] = "no-store"

    try:
        photo = db.scalar(
            select(ReportPhoto)
            .where(
                ReportPhoto.id == photo_id,
                ReportPhoto.report_id == report_id,
            )
        )

        if photo is None:
            raise HTTPException(
                status_code=404,
                detail="Photo not found.",
            )

        return _build_report_photo_preview(photo)

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Could not load the photo preview.",
        ) from None


@app.post(
    "/api/admin/reports/{report_id}/repair",
    response_model=RepairConfirmationRead,
    status_code=201,
)
def confirm_report_repair(
    report_id: UUID,
    db: DatabaseSession,
    reviewer: Annotated[
        CurrentUser,
        Depends(require_reviewer),
    ],
    note: Annotated[
        str,
        Form(min_length=10, max_length=2000),
    ],
    file: Annotated[UploadFile, File()],
):
    clean_note = note.strip()

    if len(clean_note) < 10:
        raise HTTPException(
            status_code=422,
            detail="Explain the repair in at least 10 characters.",
        )

    try:
        raw = file.file.read(MAX_UPLOAD_BYTES + 1)

    except OSError:
        raise HTTPException(
            status_code=400,
            detail="Could not read the repair photo.",
        ) from None

    if not raw:
        raise HTTPException(
            status_code=400,
            detail="A repair photo is required.",
        )

    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Repair photo must be 3 MiB or smaller.",
        )

    photo_id = uuid4()
    stored = None
    commit_attempted = False

    try:
        with db.begin():
            report = db.scalar(
                select(Report)
                .where(Report.id == report_id)
                .with_for_update()
            )

            if report is None:
                raise HTTPException(
                    status_code=404,
                    detail="Report not found.",
                )

            if report.status != "verified":
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Repair can only be confirmed "
                        "for a verified report."
                    ),
                )

            existing_confirmation = db.scalar(
                select(RepairConfirmation.id)
                .where(
                    RepairConfirmation.report_id == report_id
                )
            )

            if (
                report.repaired_at is not None
                or existing_confirmation is not None
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Repair has already been confirmed. "
                        "Reload the report."
                    ),
                )

            try:
                stored = upload_report_photo(raw, photo_id)

            except PhotoValidationError as error:
                raise HTTPException(
                    status_code=400,
                    detail=str(error),
                ) from None

            except PhotoStorageError:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Repair photo upload could not be confirmed. "
                        "Reload the report before trying again."
                    ),
                ) from None

            photo = ReportPhoto(
                id=photo_id,
                report_id=report_id,
                uploaded_by_uid=reviewer.uid,
                public_id=stored.public_id,
                asset_id=stored.asset_id,
                width=stored.width,
                height=stored.height,
                byte_size=stored.byte_count,
            )

            db.add(photo)
            db.flush()

            confirmed_at = datetime.now(timezone.utc)

            confirmation = RepairConfirmation(
                id=uuid4(),
                report_id=report_id,
                photo_id=photo_id,
                confirmed_by_uid=reviewer.uid,
                note=clean_note,
                created_at=confirmed_at,
            )

            db.add(confirmation)
            report.repaired_at = confirmed_at

            db.flush()

            result = RepairConfirmationRead.model_validate(
                confirmation
            )

            # The photo record, confirmation and repaired_at
            # are committed together in the database.
            commit_attempted = True

        return result

    except SQLAlchemyError:
        logger.warning(
            "Repair confirmation outcome uncertain: "
            "report_id=%s photo_id=%s commit_attempted=%s",
            report_id,
            photo_id,
            commit_attempted,
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Repair confirmation could not be confirmed. "
                "Reload the report before trying again."
            ),
        ) from None

    finally:
        # Before commit, a failed transaction can be rolled back
        # and its confirmed storage upload cleaned up.
        # After an uncertain commit, retain the uploaded image.
        if stored is not None and not commit_attempted:
            try:
                delete_confirmed_report_photo(
                    photo_id,
                    stored,
                )

            except PhotoStorageError:
                logger.warning(
                    "Repair photo cleanup needs follow-up: "
                    "report_id=%s photo_id=%s",
                    report_id,
                    photo_id,
                )


@app.get(
    "/api/navigation/destinations",
    response_model=list[DestinationRead],
)
def find_destinations(
    response: Response,
    q: Annotated[
        str,
        Query(min_length=3, max_length=120),
    ],
):
    response.headers["Cache-Control"] = "no-store"

    try:
        return search_destinations(q)

    except DestinationSearchError as error:
        error_statuses = {
            "invalid_query": 422,
            "not_configured": 503,
            "timeout": 504,
            "network_error": 503,
            "rate_limited": 429,
            "provider_access_error": 503,
            "provider_error": 502,
            "invalid_response": 502,
        }

        raise HTTPException(
            status_code=error_statuses.get(error.code, 503),
            detail={
                "code": error.code,
                "message": str(error),
            },
        ) from None


@app.post(
    "/api/navigation/route",
    response_model=RouteRead,
)
def plan_driver_route(
    payload: RouteRequest,
    response: Response,
):
    response.headers["Cache-Control"] = "no-store"

    try:
        return calculate_route(payload)

    except RoutingError as error:
        error_statuses = {
            "not_configured": 503,
            "timeout": 504,
            "network_error": 503,
            "rate_limited": 429,
            "provider_access_error": 503,
            "provider_error": 502,
            "invalid_response": 502,
            "no_route": 404,
        }

        raise HTTPException(
            status_code=error_statuses.get(error.code, 503),
            detail={
                "code": error.code,
                "message": str(error),
            },
        ) from None
