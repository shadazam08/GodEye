import { API_BASE_URL } from "../config";
import type { ReportRead, ReportStatus } from "../types/report";
import type { MapMatchRequest, ProviderMatchResponse } from "../types/mapMatching";
import type { ReportPhoto, ReportPhotoPreview } from "../types/photos";

export type ReviewDecision = "verified" | "rejected";

async function reviewerRequest<T>(path: string, reviewerKey: string, options: RequestInit = {}): Promise<T> {
  const key = reviewerKey.trim();

  if (!key) {
    throw new Error("Enter your reviewer key.");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${key}`);

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, 30000);

  try {
    let response: Response;

    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
      });
    } catch {
      throw new Error(
        "Could not confirm the request. Check your connection. " +
          "Refresh the report list before retrying a review decision.",
      );
    }

    if (!response.ok) {
      switch (response.status) {
        case 401:
          throw new Error("Reviewer key is missing or invalid.");

        case 404:
          throw new Error("The requested report was not found.");

        case 409:
          throw new Error("This report has already been reviewed. Refresh the list.");

        case 422:
          throw new Error("Request details are invalid. Check the submitted fields and sample timestamps.");

        default:
          throw new Error("The server could not complete the request. " + "Refresh the list before retrying.");
      }
    }

    try {
      const data: T = await response.json();
      return data;
    } catch {
      throw new Error("Could not read the server response. Refresh the list " + "before retrying a review decision.");
    }
  } finally {
    window.clearTimeout(timeout);
  }
}

export function getReviewerReports(
  reviewerKey: string,
  reviewStatus: ReportStatus = "pending",
  offset = 0,
): Promise<ReportRead[]> {
  const query = new URLSearchParams({
    review_status: reviewStatus,
    limit: "50",
    offset: String(offset),
  });

  return reviewerRequest<ReportRead[]>(`/api/admin/reports?${query.toString()}`, reviewerKey);
}

export function submitReview(
  reviewerKey: string,
  reportId: string,
  decision: ReviewDecision,
  reason: string,
): Promise<ReportRead> {
  return reviewerRequest<ReportRead>(`/api/admin/reports/${encodeURIComponent(reportId)}/review`, reviewerKey, {
    method: "PATCH",
    body: JSON.stringify({
      status: decision,
      reason: reason.trim(),
    }),
  });
}

export function matchReviewerTrace(reviewerKey: string, payload: MapMatchRequest): Promise<ProviderMatchResponse> {
  return reviewerRequest<ProviderMatchResponse>("/api/admin/map-matching", reviewerKey, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getReviewerReportPhotos(reviewerKey: string, reportId: string): Promise<ReportPhoto[]> {
  return reviewerRequest<ReportPhoto[]>(`/api/admin/reports/${encodeURIComponent(reportId)}/photos`, reviewerKey);
}

export function getReviewerPhotoPreview(
  reviewerKey: string,
  reportId: string,
  photoId: string,
): Promise<ReportPhotoPreview> {
  return reviewerRequest<ReportPhotoPreview>(
    `/api/admin/reports/${encodeURIComponent(reportId)}` + `/photos/${encodeURIComponent(photoId)}/preview`,
    reviewerKey,
  );
}
