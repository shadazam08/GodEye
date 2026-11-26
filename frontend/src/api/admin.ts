import { auth } from "../lib/firebase";
import { API_BASE_URL } from "../config";
import type { ReportRead, ReportStatus } from "../types/report";
import type { ReportPhoto, ReportPhotoPreview } from "../types/photos";

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("The API address is not configured.");
  }

  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please sign in with your admin account.");
  }

  const uid = user.uid;
  const token = await user.getIdToken();

  if (auth.currentUser?.uid !== uid) {
    throw new Error("Your account changed. Please try again.");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
    });

    if (auth.currentUser?.uid !== uid) {
      throw new Error("Your account changed. Reopen the dashboard.");
    }

    if (response.status === 401) {
      throw new Error("Please sign in again.");
    }

    if (response.status === 403) {
      throw new Error("This account does not have admin access. " + "Sign in with an authorized admin account.");
    }

    if (response.status === 404) {
      throw new Error("The report or photo was not found.");
    }

    if (response.status === 409) {
      throw new Error(
        "The report status has changed or this action was already completed. " + "Reload the list before continuing.",
      );
    }

    if (response.status === 400) {
      throw new Error("Please provide a valid JPEG or PNG photo.");
    }

    if (response.status === 413) {
      throw new Error("The photo must be 3 MiB or smaller.");
    }

    if (response.status === 422) {
      throw new Error("Check the review decision and reason.");
    }

    if (!response.ok) {
      throw new Error("The request could not be confirmed. " + "Reload the queue before retrying a decision.");
    }

    const result: T = await response.json();

    if (auth.currentUser?.uid !== uid) {
      throw new Error("Your account changed. Reopen the dashboard.");
    }

    return result;
  } catch (error) {
    if (
      error instanceof TypeError ||
      error instanceof SyntaxError ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw new Error(
        "The request could not be confirmed. Check your connection " +
          "and reload the queue before retrying a decision.",
        { cause: error },
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function getAdminReports(
  offset = 0,
  reviewStatus: ReportStatus = "pending",
  mine = false,
): Promise<ReportRead[]> {
  const query = new URLSearchParams({
    review_status: reviewStatus,
    mine: String(mine),
    limit: "50",
    offset: String(offset),
  });

  return adminRequest<ReportRead[]>(`/api/admin/reports?${query}`);
}

export function saveAdminReview(
  reportId: string,
  decision: "verified" | "rejected",
  reason: string,
): Promise<ReportRead> {
  return adminRequest<ReportRead>(`/api/admin/reports/${encodeURIComponent(reportId)}/review`, {
    method: "PATCH",
    body: JSON.stringify({
      status: decision,
      reason: reason.trim(),
    }),
  });
}

export function getAdminPhotos(reportId: string): Promise<ReportPhoto[]> {
  return adminRequest<ReportPhoto[]>(`/api/admin/reports/${encodeURIComponent(reportId)}/photos`);
}

export function getAdminPhotoPreview(reportId: string, photoId: string): Promise<ReportPhotoPreview> {
  return adminRequest<ReportPhotoPreview>(
    `/api/admin/reports/${encodeURIComponent(reportId)}` + `/photos/${encodeURIComponent(photoId)}/preview`,
  );
}

export type AdminReviewEvent = {
  id: string;
  report_id: string;
  previous_status: ReportStatus;
  new_status: "verified" | "rejected";
  reviewer_uid: string | null;
  reviewer_label: string;
  reason: string;
  created_at: string;
};

export function getAdminReviewHistory(reportId: string, offset = 0): Promise<AdminReviewEvent[]> {
  const query = new URLSearchParams({
    limit: "50",
    offset: String(offset),
  });

  return adminRequest<AdminReviewEvent[]>(`/api/admin/reports/${encodeURIComponent(reportId)}` + `/history?${query}`);
}

export type RepairConfirmation = {
  id: string;
  report_id: string;
  photo_id: string;
  note: string;
  created_at: string;
};

export function confirmAdminRepair(reportId: string, note: string, photo: File): Promise<RepairConfirmation> {
  const cleanNote = note.trim();

  if (cleanNote.length < 10 || cleanNote.length > 2000) {
    throw new Error("Repair note must contain 10–2000 characters.");
  }

  if (!photo.size || photo.size > 3 * 1024 * 1024) {
    throw new Error("Select a photo of 3 MiB or smaller.");
  }

  if (!["image/jpeg", "image/png"].includes(photo.type)) {
    throw new Error("Select a JPEG or PNG photo.");
  }

  const body = new FormData();
  body.append("note", cleanNote);
  body.append("file", photo);

  return adminRequest<RepairConfirmation>(`/api/admin/reports/${encodeURIComponent(reportId)}/repair`, {
    method: "POST",
    body,
  });
}
