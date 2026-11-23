export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METRES = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function validateCoordinates(point: Coordinates): void {
  if (
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    point.latitude < -90 ||
    point.latitude > 90 ||
    point.longitude < -180 ||
    point.longitude > 180
  ) {
    throw new Error("Invalid geographic coordinates.");
  }
}

export function distanceInMetres(start: Coordinates, end: Coordinates): number {
  validateCoordinates(start);
  validateCoordinates(end);

  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);

  const latitudeDifference = toRadians(end.latitude - start.latitude);

  const longitudeDifference = toRadians(end.longitude - start.longitude);

  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDifference / 2) ** 2;

  // Keep floating-point rounding within the valid range.
  const boundedValue = Math.min(1, Math.max(0, haversine));

  const centralAngle = 2 * Math.atan2(Math.sqrt(boundedValue), Math.sqrt(1 - boundedValue));

  return EARTH_RADIUS_METRES * centralAngle;
}

export function initialBearingDegrees(start: Coordinates, end: Coordinates): number | null {
  validateCoordinates(start);
  validateCoordinates(end);

  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);

  const longitudeDifference = toRadians(end.longitude - start.longitude);

  const east = Math.sin(longitudeDifference) * Math.cos(endLatitude);

  const north =
    Math.cos(startLatitude) * Math.sin(endLatitude) -
    Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDifference);

  // Coincident and antipodal points have no unique initial bearing.
  if (Math.hypot(east, north) < 1e-12) {
    return null;
  }

  const degrees = (Math.atan2(east, north) * 180) / Math.PI;

  return (degrees + 360) % 360;
}

export function angularDifferenceDegrees(first: number, second: number): number {
  if (!Number.isFinite(first) || !Number.isFinite(second) || first < 0 || first >= 360 || second < 0 || second >= 360) {
    throw new Error("Angles must be finite values from 0 to under 360.");
  }

  const difference = Math.abs(first - second);

  return Math.min(difference, 360 - difference);
}

export interface ApproachReading extends Coordinates {
  timestamp: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
}

export interface HazardPoint extends Coordinates {
  status: string;
}

export type ApproachAssessment =
  | {
      state: "blocked";
      reason: string;
    }
  | {
      state: "candidate";
      distanceMetres: number;
      bearingDegrees: number;
      headingDifferenceDegrees: number;
    };

// Initial development settings, not validated safety thresholds.
export const APPROACH_LIMITS = {
  maxReadingAgeMs: 15_000,
  maxAccuracyMetres: 25,
  maxDistanceMetres: 200,
  minSpeedMetresPerSecond: 1,
  maxHeadingDifferenceDegrees: 45,
} as const;

export function assessHazardApproach(reading: ApproachReading, hazard: HazardPoint, now: number): ApproachAssessment {
  if (hazard.status !== "verified") {
    return { state: "blocked", reason: "Report is not verified." };
  }

  try {
    validateCoordinates(reading);
    validateCoordinates(hazard);
  } catch {
    return { state: "blocked", reason: "Invalid coordinates." };
  }

  if (
    !Number.isFinite(now) ||
    !Number.isFinite(reading.timestamp) ||
    !Number.isFinite(reading.accuracy) ||
    reading.accuracy < 0
  ) {
    return { state: "blocked", reason: "Invalid location metadata." };
  }

  const age = now - reading.timestamp;

  if (age < 0 || age > APPROACH_LIMITS.maxReadingAgeMs) {
    return {
      state: "blocked",
      reason: "A recent location reading is required.",
    };
  }

  if (reading.accuracy > APPROACH_LIMITS.maxAccuracyMetres) {
    return {
      state: "blocked",
      reason: "Location accuracy is insufficient for approach assessment.",
    };
  }

  if (reading.heading === null || !Number.isFinite(reading.heading) || reading.heading < 0 || reading.heading >= 360) {
    return {
      state: "blocked",
      reason: "Travel direction is unavailable or invalid.",
    };
  }

  if (
    reading.speed === null ||
    !Number.isFinite(reading.speed) ||
    reading.speed < APPROACH_LIMITS.minSpeedMetresPerSecond
  ) {
    return {
      state: "blocked",
      reason: "A usable moving-speed reading is required.",
    };
  }

  const distance = distanceInMetres(reading, hazard);

  if (distance > APPROACH_LIMITS.maxDistanceMetres) {
    return {
      state: "blocked",
      reason: "Hazard is outside the assessment radius.",
    };
  }

  const bearing = initialBearingDegrees(reading, hazard);

  if (bearing === null) {
    return {
      state: "blocked",
      reason: "Hazard direction cannot be determined.",
    };
  }

  const headingDifference = angularDifferenceDegrees(reading.heading, bearing);

  if (headingDifference > APPROACH_LIMITS.maxHeadingDifferenceDegrees) {
    return {
      state: "blocked",
      reason: "Hazard is outside the forward direction filter.",
    };
  }

  return {
    state: "candidate",
    distanceMetres: distance,
    bearingDegrees: bearing,
    headingDifferenceDegrees: headingDifference,
  };
}
