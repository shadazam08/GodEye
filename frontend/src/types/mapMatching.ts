export type TravelMode = "drive" | "motorcycle";

export interface LocationSample {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy: number;
  heading?: number | null;
}

export interface MapMatchRequest {
  mode: TravelMode;
  samples: LocationSample[];
}

// GeoJSON coordinates are longitude first, then latitude.
export type GeoJsonCoordinate = [number, number];

export interface MatchedWaypoint {
  original_index: number;
  original_location: GeoJsonCoordinate;
  location: GeoJsonCoordinate | null;

  match_type: "matched" | "unmatched" | "interpolated" | "merged";

  match_distance: number | null;
  leg_index: number | null;
  step_index: number | null;
}

export interface MatchedRoadStep {
  from_index: number;
  to_index: number;
  osm_way_id: number | string | null;
  name: string | null;
  bridge: boolean | null;
  tunnel: boolean | null;
}

export interface MatchedLeg {
  steps: MatchedRoadStep[];
}

export interface MatchedRouteFeature {
  type: "Feature";

  properties: {
    waypoints: MatchedWaypoint[];
    legs: MatchedLeg[];
    distance: number | null;
  };

  geometry: {
    type: "MultiLineString";
    coordinates: GeoJsonCoordinate[][];
  };
}

export interface ProviderMatchResponse {
  type: "FeatureCollection";
  features: MatchedRouteFeature[];
}
