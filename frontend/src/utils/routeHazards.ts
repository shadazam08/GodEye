import type { Coordinates } from "./geo";
import type { RoutePlan } from "../types/navigation";

type Vector = [number, number, number];

type RouteHazard = Coordinates & {
  status: string;
  repaired_at: string | null;
};

export type RouteProximity =
  | { state: "excluded" }
  | { state: "unavailable" }
  | {
      state: "near" | "far";
      distanceMetres: number;
    };

// Development filter, not a validated warning threshold.
export const ROUTE_PROXIMITY_METRES = 40;

const EARTH_RADIUS = 6_371_000;

function dot(a: Vector, b: Vector): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vector, b: Vector): Vector {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function length(vector: Vector): number {
  return Math.hypot(...vector);
}

function angle(a: Vector, b: Vector): number {
  return Math.atan2(length(cross(a, b)), dot(a, b));
}

function coordinateVector(value: unknown): Vector {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1]) ||
    Math.abs(value[0]) > 180 ||
    Math.abs(value[1]) > 90
  ) {
    throw new Error("Invalid route coordinates.");
  }

  const longitude = (value[0] * Math.PI) / 180;
  const latitude = (value[1] * Math.PI) / 180;

  return [Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)];
}

function segmentDistance(point: Vector, start: Vector, end: Vector): number {
  const segmentAngle = angle(start, end);

  if (Math.PI - segmentAngle < 1e-10) {
    throw new Error("Ambiguous route segment.");
  }

  let nearestAngle = Math.min(angle(point, start), angle(point, end));

  const normal = cross(start, end);
  const normalLength = length(normal);

  // Repeated route coordinates represent a single point.
  if (normalLength < 1e-12) {
    return nearestAngle * EARTH_RADIUS;
  }

  const unitNormal: Vector = [normal[0] / normalLength, normal[1] / normalLength, normal[2] / normalLength];

  const offset = dot(point, unitNormal);

  const projection: Vector = [
    point[0] - offset * unitNormal[0],
    point[1] - offset * unitNormal[1],
    point[2] - offset * unitNormal[2],
  ];

  const projectionLength = length(projection);

  if (projectionLength > 1e-12) {
    const closest: Vector = [
      projection[0] / projectionLength,
      projection[1] / projectionLength,
      projection[2] / projectionLength,
    ];

    const throughClosest = angle(start, closest) + angle(closest, end);

    // Only accept a projection on the segment, not its extension.
    if (throughClosest <= segmentAngle + 1e-10) {
      nearestAngle = Math.min(nearestAngle, angle(point, closest));
    }
  }

  return nearestAngle * EARTH_RADIUS;
}

export function distanceToRouteMetres(point: Coordinates, geometry: RoutePlan["geometry"]): number {
  const pointVector = coordinateVector([point.longitude, point.latitude]);

  if (
    geometry.type !== "MultiLineString" ||
    !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length === 0
  ) {
    throw new Error("Route geometry is unavailable.");
  }

  let nearest = Number.POSITIVE_INFINITY;

  for (const line of geometry.coordinates) {
    if (!Array.isArray(line) || line.length < 2) {
      throw new Error("Invalid route line.");
    }

    let previous = coordinateVector(line[0]);

    for (let index = 1; index < line.length; index += 1) {
      const current = coordinateVector(line[index]);

      nearest = Math.min(nearest, segmentDistance(pointVector, previous, current));

      previous = current;
    }
  }

  return nearest;
}

export function assessRouteProximity(
  hazard: RouteHazard,
  geometry: RoutePlan["geometry"],
  corridorMetres = ROUTE_PROXIMITY_METRES,
): RouteProximity {
  if (!Number.isFinite(corridorMetres) || corridorMetres < 0) {
    throw new Error("Invalid route proximity limit.");
  }

  // Missing repair metadata is excluded as well.
  if (hazard.status !== "verified" || hazard.repaired_at !== null) {
    return { state: "excluded" };
  }

  try {
    const distanceMetres = distanceToRouteMetres(hazard, geometry);

    return {
      state: distanceMetres <= corridorMetres ? "near" : "far",
      distanceMetres,
    };
  } catch {
    return { state: "unavailable" };
  }
}

type RouteLocationReading = Coordinates & {
  timestamp: number;
  accuracy: number;
};

export type RouteLocationAssessment =
  | {
      state: "blocked";
      reason:
        | "location_inactive"
        | "location_missing"
        | "invalid_location"
        | "location_stale"
        | "accuracy_insufficient"
        | "route_unavailable"
        | "off_route";
    }
  | {
      state: "usable";
      distanceFromRouteMetres: number;
    };

// Development limits, not validated safety thresholds.
export const ROUTE_LOCATION_LIMITS = {
  maxAgeMs: 15_000,
  maxAccuracyMetres: 25,
  maxRouteDistanceMetres: 40,
} as const;

export function assessRouteLocation(
  reading: RouteLocationReading | null,
  geometry: RoutePlan["geometry"],
  now: number,
  trackingStatus: string,
): RouteLocationAssessment {
  if (trackingStatus !== "tracking") {
    return {
      state: "blocked",
      reason: "location_inactive",
    };
  }

  if (!reading) {
    return {
      state: "blocked",
      reason: "location_missing",
    };
  }

  if (
    !Number.isFinite(now) ||
    !Number.isFinite(reading.timestamp) ||
    !Number.isFinite(reading.accuracy) ||
    reading.accuracy < 0 ||
    !Number.isFinite(reading.latitude) ||
    !Number.isFinite(reading.longitude) ||
    Math.abs(reading.latitude) > 90 ||
    Math.abs(reading.longitude) > 180
  ) {
    return {
      state: "blocked",
      reason: "invalid_location",
    };
  }

  const age = now - reading.timestamp;

  if (age < 0 || age > ROUTE_LOCATION_LIMITS.maxAgeMs) {
    return {
      state: "blocked",
      reason: "location_stale",
    };
  }

  if (reading.accuracy > ROUTE_LOCATION_LIMITS.maxAccuracyMetres) {
    return {
      state: "blocked",
      reason: "accuracy_insufficient",
    };
  }

  let distanceFromRouteMetres: number;

  try {
    distanceFromRouteMetres = distanceToRouteMetres(reading, geometry);
  } catch {
    return {
      state: "blocked",
      reason: "route_unavailable",
    };
  }

  if (distanceFromRouteMetres > ROUTE_LOCATION_LIMITS.maxRouteDistanceMetres) {
    return {
      state: "blocked",
      reason: "off_route",
    };
  }

  return {
    state: "usable",
    distanceFromRouteMetres,
  };
}

export type RouteProgress = {
  distanceFromRouteMetres: number;
  alongRouteMetres: number;
};

type SegmentProgress = {
  distanceMetres: number;
  alongSegmentMetres: number;
};

// Development settings; these require field validation.
const PROGRESS_LIMITS = {
  comparableDistanceMetres: 5,
  ambiguousProgressMetres: 30,
  minimumOrderGapMetres: 30,
  maximumJoinGapMetres: 0.1,
} as const;

function segmentProgress(point: Vector, start: Vector, end: Vector): SegmentProgress {
  const startDistance = angle(point, start) * EARTH_RADIUS;
  const endDistance = angle(point, end) * EARTH_RADIUS;
  const segmentAngle = angle(start, end);

  if (Math.PI - segmentAngle < 1e-10) {
    throw new Error("Ambiguous route segment.");
  }

  let result: SegmentProgress =
    startDistance <= endDistance
      ? {
          distanceMetres: startDistance,
          alongSegmentMetres: 0,
        }
      : {
          distanceMetres: endDistance,
          alongSegmentMetres: segmentAngle * EARTH_RADIUS,
        };

  const normal = cross(start, end);
  const normalLength = length(normal);

  if (normalLength < 1e-12) return result;

  const unitNormal: Vector = [normal[0] / normalLength, normal[1] / normalLength, normal[2] / normalLength];

  const offset = dot(point, unitNormal);

  const projection: Vector = [
    point[0] - offset * unitNormal[0],
    point[1] - offset * unitNormal[1],
    point[2] - offset * unitNormal[2],
  ];

  const projectionLength = length(projection);

  if (projectionLength < 1e-12) return result;

  const closest: Vector = [
    projection[0] / projectionLength,
    projection[1] / projectionLength,
    projection[2] / projectionLength,
  ];

  const fromStart = angle(start, closest);
  const toEnd = angle(closest, end);

  if (fromStart + toEnd <= segmentAngle + 1e-10) {
    const distanceMetres = angle(point, closest) * EARTH_RADIUS;

    if (distanceMetres <= result.distanceMetres) {
      result = {
        distanceMetres,
        alongSegmentMetres: fromStart * EARTH_RADIUS,
      };
    }
  }

  return result;
}

export function projectRouteProgress(point: Coordinates, geometry: RoutePlan["geometry"]): RouteProgress | null {
  try {
    const pointVector = coordinateVector([point.longitude, point.latitude]);

    if (
      geometry.type !== "MultiLineString" ||
      !Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length === 0
    ) {
      return null;
    }

    const candidates: RouteProgress[] = [];
    let travelled = 0;
    let previousLineEnd: Vector | null = null;

    for (const line of geometry.coordinates) {
      if (!Array.isArray(line) || line.length < 2) {
        return null;
      }

      let previous = coordinateVector(line[0]);

      // Do not invent a traversable connection across missing geometry.
      if (previousLineEnd && angle(previousLineEnd, previous) * EARTH_RADIUS > PROGRESS_LIMITS.maximumJoinGapMetres) {
        return null;
      }

      for (let index = 1; index < line.length; index += 1) {
        const current = coordinateVector(line[index]);
        const segmentLength = angle(previous, current) * EARTH_RADIUS;

        const projected = segmentProgress(pointVector, previous, current);

        candidates.push({
          distanceFromRouteMetres: projected.distanceMetres,
          alongRouteMetres: travelled + projected.alongSegmentMetres,
        });

        travelled += segmentLength;
        previous = current;
      }

      previousLineEnd = previous;
    }

    if (travelled < 0.01 || candidates.length === 0) {
      return null;
    }

    candidates.sort((first, second) => first.distanceFromRouteMetres - second.distanceFromRouteMetres);

    const nearest = candidates[0];

    if (!nearest || nearest.distanceFromRouteMetres > ROUTE_PROXIMITY_METRES) {
      return null;
    }

    // At a crossing or loop, a point can match distant parts
    // of the route equally well. Do not choose one arbitrarily.
    const ambiguous = candidates.some(
      (candidate) =>
        candidate.distanceFromRouteMetres <=
          nearest.distanceFromRouteMetres + PROGRESS_LIMITS.comparableDistanceMetres &&
        Math.abs(candidate.alongRouteMetres - nearest.alongRouteMetres) > PROGRESS_LIMITS.ambiguousProgressMetres,
    );

    return ambiguous ? null : nearest;
  } catch {
    return null;
  }
}

export type HazardRouteOrder =
  | { state: "excluded" }
  | { state: "blocked" }
  | { state: "uncertain" }
  | {
      state: "later" | "earlier";
      separationAlongRouteMetres: number;
    };

export function assessHazardRouteOrder(
  reading: RouteLocationReading | null,
  hazard: RouteHazard,
  geometry: RoutePlan["geometry"],
  now: number,
  trackingStatus: string,
): HazardRouteOrder {
  if (hazard.status !== "verified" || hazard.repaired_at !== null) {
    return { state: "excluded" };
  }

  const locationCheck = assessRouteLocation(reading, geometry, now, trackingStatus);

  if (locationCheck.state !== "usable" || !reading) {
    return { state: "blocked" };
  }

  const driverProgress = projectRouteProgress(reading, geometry);
  const hazardProgress = projectRouteProgress(hazard, geometry);

  if (!driverProgress || !hazardProgress) {
    return { state: "uncertain" };
  }

  const difference = hazardProgress.alongRouteMetres - driverProgress.alongRouteMetres;

  const uncertaintyMargin = Math.max(PROGRESS_LIMITS.minimumOrderGapMetres, reading.accuracy * 2);

  if (Math.abs(difference) <= uncertaintyMargin) {
    return { state: "uncertain" };
  }

  return {
    state: difference > 0 ? "later" : "earlier",
    separationAlongRouteMetres: Math.abs(difference),
  };
}
