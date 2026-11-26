import { API_BASE_URL } from "../config";
import type { Destination, RoutePlan, RouteRequest } from "../types/navigation";

function isDestination(value: unknown): value is Destination {
  if (typeof value !== "object" || value === null) return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.place_id === "string" &&
    item.place_id.length > 0 &&
    typeof item.label === "string" &&
    item.label.trim().length > 0 &&
    typeof item.latitude === "number" &&
    Number.isFinite(item.latitude) &&
    Math.abs(item.latitude) <= 90 &&
    typeof item.longitude === "number" &&
    Number.isFinite(item.longitude) &&
    Math.abs(item.longitude) <= 180
  );
}

export async function searchDestinations(query: string, signal: AbortSignal): Promise<Destination[]> {
  const params = new URLSearchParams({ q: query.trim() });

  const response = await fetch(`${API_BASE_URL}/api/navigation/destinations?${params}`, {
    signal,
    cache: "no-store",
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? "Search is temporarily limited. Please try again later."
        : "Could not search destinations. Please try again.",
    );
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data) || data.length > 5 || !data.every(isDestination)) {
    throw new Error("Destination search returned invalid results.");
  }

  return data;
}

function isRoutePlan(value: unknown): value is RoutePlan {
  if (typeof value !== "object" || value === null) return false;

  const route = value as Record<string, unknown>;

  if (
    !["drive", "motorcycle"].includes(String(route.mode)) ||
    typeof route.distance_m !== "number" ||
    !Number.isFinite(route.distance_m) ||
    route.distance_m < 0 ||
    typeof route.duration_s !== "number" ||
    !Number.isFinite(route.duration_s) ||
    route.duration_s < 0 ||
    typeof route.attribution !== "string" ||
    typeof route.geometry !== "object" ||
    route.geometry === null
  ) {
    return false;
  }

  const geometry = route.geometry as Record<string, unknown>;

  return (
    geometry.type === "MultiLineString" &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length > 0 &&
    geometry.coordinates.length <= 100 &&
    geometry.coordinates.every(
      (line: unknown) =>
        Array.isArray(line) &&
        line.length >= 2 &&
        line.length <= 100000 &&
        line.every(
          (point: unknown) =>
            Array.isArray(point) &&
            point.length === 2 &&
            typeof point[0] === "number" &&
            Number.isFinite(point[0]) &&
            Math.abs(point[0]) <= 180 &&
            typeof point[1] === "number" &&
            Number.isFinite(point[1]) &&
            Math.abs(point[1]) <= 90,
        ),
    )
  );
}

export async function getDrivingRoute(payload: RouteRequest, signal: AbortSignal): Promise<RoutePlan> {
  const response = await fetch(`${API_BASE_URL}/api/navigation/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
    cache: "no-store",
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "No road route was found. Try another destination."
        : response.status === 429
          ? "Route planning is temporarily limited. Try later."
          : "Could not calculate the route. Please try again.",
    );
  }

  const data: unknown = await response.json();

  if (!isRoutePlan(data) || data.mode !== payload.mode) {
    throw new Error("The route response could not be validated.");
  }

  return data;
}
