import { auth } from "../lib/firebase";
import type { ReportPhoto, ReportPhotoPreview } from "../types/photos";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

async function photoRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("The API address is not configured.");
  }

  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please sign in to manage report photos.");
  }

  const uid = user.uid;
  const token = await user.getIdToken();

  if (auth.currentUser?.uid !== uid) {
    throw new Error("Your account changed. Please try again.");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);

  const isUpload = options.method === "POST";

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });

    if (auth.currentUser?.uid !== uid) {
      throw new Error("Your account changed. Please refresh your reports.");
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Please sign in again.");
      }

      if (response.status === 403) {
        throw new Error("Your account does not have permission for this action.");
      }

      if (response.status === 404) {
        throw new Error("The report or photo was not found.");
      }

      if (response.status === 409) {
        throw new Error(
          "Photos can only be added to pending reports, " +
            "with a maximum of 3 photos per report. " +
            "Refresh the photo list.",
        );
      }

      if (response.status === 413) {
        throw new Error("Please select a photo of 3 MiB or smaller.");
      }

      if (response.status === 400 || response.status === 422) {
        throw new Error("The photo could not be accepted. " + "Please select a valid JPEG or PNG image.");
      }

      throw new Error(
        isUpload
          ? "Photo upload could not be confirmed. " + "Refresh the photo list before uploading again."
          : "Photos are temporarily unavailable. Please try again.",
      );
    }

    const data: T = await response.json();

    if (auth.currentUser?.uid !== uid) {
      throw new Error("Your account changed. Please refresh your reports.");
    }

    return data;
  } catch (error) {
    if (
      error instanceof TypeError ||
      error instanceof SyntaxError ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw new Error(
        isUpload
          ? "Photo upload could not be confirmed. " + "Refresh the photo list before uploading again."
          : "Could not load photos. Check your connection and try again.",
        { cause: error },
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function getReportPhotos(reportId: string): Promise<ReportPhoto[]> {
  return photoRequest<ReportPhoto[]>(`/api/reports/${encodeURIComponent(reportId)}/photos`);
}

export async function uploadReportPhoto(reportId: string, file: File): Promise<ReportPhoto> {
  if (file.size === 0) {
    throw new Error("Please select a non-empty photo.");
  }

  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Please select a photo of 3 MiB or smaller.");
  }

  const form = new FormData();
  form.append("file", file);

  return photoRequest<ReportPhoto>(`/api/reports/${encodeURIComponent(reportId)}/photos`, {
    method: "POST",
    body: form,
  });
}

export function getReportPhotoPreview(reportId: string, photoId: string): Promise<ReportPhotoPreview> {
  return photoRequest<ReportPhotoPreview>(
    `/api/reports/${encodeURIComponent(reportId)}` + `/photos/${encodeURIComponent(photoId)}/preview`,
  );
}
