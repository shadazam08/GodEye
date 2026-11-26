export type Destination = {
  place_id: string
  label: string
  latitude: number
  longitude: number
}

export type TravelMode = 'drive' | 'motorcycle'

export type RouteRequest = {
  start: {
    latitude: number
    longitude: number
  }
  destination: {
    latitude: number
    longitude: number
  }
  mode: TravelMode
}

export type RoutePlan = {
  mode: TravelMode
  distance_m: number
  duration_s: number
  geometry: {
    type: 'MultiLineString'
    coordinates: [number, number][][]
  }
  attribution: string
}