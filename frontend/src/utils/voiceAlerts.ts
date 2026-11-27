import { assessHazardApproach } from "./geo.ts";
import type { ApproachReading, HazardPoint } from "./geo.ts";
import { assessHazardRouteOrder, assessRouteLocation } from "./routeHazards.ts";
import type { RoutePlan } from "../types/navigation";

type AlertReport = HazardPoint & {
  id: string;
  repaired_at: string | null;
};

type AlertInput = {
  reading: ApproachReading | null;
  geometry: RoutePlan["geometry"] | null;
  reports: readonly AlertReport[];
  trackingStatus: string;
  reportsStatus: string;
  visible: boolean;
  now: number;
};

export type VoiceAlertCandidate = {
  id: string;
  distance: number;
};

// Development values, not validated safety thresholds.
export const VOICE_ALERT_DISTANCE_METRES = 200;
export const VOICE_ALERT_COOLDOWN_MS = 25_000;

export function selectVoiceAlert(input: AlertInput): VoiceAlertCandidate | null {
  const { reading, geometry, reports, trackingStatus, reportsStatus, visible, now } = input;

  if (!visible || !reading || !geometry || reportsStatus !== "ready" || !Number.isFinite(now)) {
    return null;
  }

  const location = assessRouteLocation(reading, geometry, now, trackingStatus);

  if (location.state !== "usable") return null;

  let nearest: VoiceAlertCandidate | null = null;

  for (const report of reports) {
    if (!report.id || report.status !== "verified" || report.repaired_at !== null) {
      continue;
    }

    const order = assessHazardRouteOrder(reading, report, geometry, now, trackingStatus);

    if (
      order.state !== "later" ||
      !Number.isFinite(order.separationAlongRouteMetres) ||
      order.separationAlongRouteMetres <= 0 ||
      order.separationAlongRouteMetres > VOICE_ALERT_DISTANCE_METRES
    ) {
      continue;
    }

    const approach = assessHazardApproach(reading, report, now);

    if (approach.state !== "candidate") continue;

    if (nearest === null || order.separationAlongRouteMetres < nearest.distance) {
      nearest = {
        id: report.id,
        distance: order.separationAlongRouteMetres,
      };
    }
  }

  return nearest;
}

export function canAnnounceVoiceAlert(
  candidate: VoiceAlertCandidate | null,
  announcedIds: ReadonlySet<string>,
  lastStartedAt: number,
  now: number,
): boolean {
  if (
    !candidate ||
    !candidate.id ||
    !Number.isFinite(candidate.distance) ||
    candidate.distance <= 0 ||
    candidate.distance > VOICE_ALERT_DISTANCE_METRES ||
    !Number.isFinite(now) ||
    announcedIds.has(candidate.id)
  ) {
    return false;
  }

  if (lastStartedAt === Number.NEGATIVE_INFINITY) {
    return true;
  }

  if (!Number.isFinite(lastStartedAt) || lastStartedAt > now) {
    return false;
  }

  return now - lastStartedAt >= VOICE_ALERT_COOLDOWN_MS;
}
