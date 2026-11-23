import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface SelectedLocation {
  latitude: number
  longitude: number
}

interface LocationPickerProps {
  value: SelectedLocation | null
  onSelect: (location: SelectedLocation) => void
  disabled?: boolean
}

function LocationPicker({
  value,
  onSelect,
  disabled = false,
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)

  const onSelectRef = useRef(onSelect)
  const disabledRef = useRef(disabled)

  const [tilesUnavailable, setTilesUnavailable] = useState(false)

  const latitude = value?.latitude
  const longitude = value?.longitude

  // Keep the map's click handler connected to current props.
  useEffect(() => {
    onSelectRef.current = onSelect
    disabledRef.current = disabled
  }, [onSelect, disabled])

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const map = L.map(container, {
      scrollWheelZoom: false,
    }).setView([28.6139, 77.209], 13)

    mapRef.current = map

    const tiles = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      },
    )

    const handleTileError = () => {
      setTilesUnavailable(true)
    }

    const handleMapClick = (event: L.LeafletMouseEvent) => {
      if (disabledRef.current) {
        return
      }

      const point = event.latlng.wrap()

      if (point.lat < -90 || point.lat > 90) {
        return
      }

      onSelectRef.current({
        latitude: Number(point.lat.toFixed(6)),
        longitude: Number(point.lng.toFixed(6)),
      })
    }

    tiles.on('tileerror', handleTileError)
    tiles.addTo(map)

    map.on('click', handleMapClick)

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize()
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      map.off('click', handleMapClick)
      tiles.off('tileerror', handleTileError)

      markerRef.current = null
      mapRef.current = null

      map.remove()
    }
  }, [])

  // Keep the marker synchronized with the form's coordinates.
  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    if (latitude === undefined || longitude === undefined) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    const position: L.LatLngTuple = [latitude, longitude]

    if (markerRef.current) {
      markerRef.current.setLatLng(position)
    } else {
      markerRef.current = L.circleMarker(position, {
        radius: 10,
        color: '#ffffff',
        weight: 2,
        fillColor: '#22d3ee',
        fillOpacity: 1,
      }).addTo(map)
    }
  }, [latitude, longitude])

  return (
    <div className="form-field">
      <h3 style={{ margin: 0, fontSize: '16px' }}>
        Select the pothole location
      </h3>

      <p className="section-note" style={{ margin: 0 }}>
        Zoom in, then click or tap the road where the pothole is.
        Delhi is the initial view, not your current location.
        You can also enter coordinates in the fields below.
      </p>

      <div
        ref={containerRef}
        role="region"
        aria-label="Map for selecting the reported pothole location"
        style={{
          width: '100%',
          height: '300px',
          border: '1px solid #40516a',
          borderRadius: '10px',
          overflow: 'hidden',
          background: '#152236',
        }}
      />

      <p className="section-note" role="status" style={{ margin: 0 }}>
        {latitude !== undefined && longitude !== undefined
          ? `Selected location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          : 'No location selected yet.'}
      </p>

      {disabled && (
        <p className="section-note">
          Location selection is disabled while submitting.
        </p>
      )}

      {tilesUnavailable && (
        <p className="section-note" role="status">
          Some map tiles could not load. You can still enter
          coordinates manually.
        </p>
      )}
    </div>
  )
}

export default LocationPicker