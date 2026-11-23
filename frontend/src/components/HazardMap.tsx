import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { API_BASE_URL } from '../config'

import type { ReportRead, Severity } from '../types/report'

const severityColors: Record<Severity, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
}

function HazardMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const hazardLayerRef = useRef<L.LayerGroup | null>(null)

  const [tilesUnavailable, setTilesUnavailable] = useState(false)
  const [loadState, setLoadState] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [hazardCount, setHazardCount] = useState(0)
  const [refreshCount, setRefreshCount] = useState(0)

  // Create the map once when the component mounts.
  useEffect(() => {
    const container = mapContainerRef.current

    if (!container) {
      return
    }

    const map = L.map(container).setView([28.6139, 77.209], 13)

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

    tiles.on('tileerror', handleTileError)
    tiles.addTo(map)

    const hazardLayer = L.layerGroup().addTo(map)
    hazardLayerRef.current = hazardLayer

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize()
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      tiles.off('tileerror', handleTileError)
      hazardLayerRef.current = null
      map.remove()
    }
  }, [])

  // Fetch verified reports on initial load and on refresh.
  useEffect(() => {
    const controller = new AbortController()
    let active = true

    const hazardLayer = hazardLayerRef.current

    if (!hazardLayer) {
      return
    }

    const timeout = window.setTimeout(() => {
      controller.abort()
    }, 15000)

    async function loadHazards() {
      setLoadState('loading')
      setHazardCount(0)
      hazardLayer!.clearLayers()

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/hazards?limit=200&offset=0`,
          { signal: controller.signal },
        )

        if (!response.ok) {
          throw new Error('Could not load hazards.')
        }

        const reports: ReportRead[] = await response.json()

        if (!Array.isArray(reports)) {
          throw new Error('Unexpected hazard response.')
        }

        if (!active) {
          return
        }

        for (const report of reports) {
          // Defensive check: only verified records become markers.
          if (report.status !== 'verified') {
            continue
          }

          const popup = document.createElement('div')

          const title = document.createElement('strong')
          title.textContent = report.title

          const details = document.createElement('p')
          details.textContent =
            `${report.location_name} — ` +
            `Reported severity: ${report.severity}. ` +
            'Status: verified.'

          popup.append(title, details)

          L.circleMarker(
            [report.latitude, report.longitude],
            {
              radius: 9,
              color: '#ffffff',
              weight: 2,
              fillColor: severityColors[report.severity],
              fillOpacity: 0.9,
            },
          )
            .bindPopup(popup)
            .addTo(hazardLayer!)
        }

        setHazardCount(hazardLayer!.getLayers().length)
        setLoadState('ready')
      } catch {
        if (active) {
          hazardLayer!.clearLayers()
          setHazardCount(0)
          setLoadState('error')
        }
      } finally {
        window.clearTimeout(timeout)
      }
    }

    void loadHazards()

    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [refreshCount])

  return (
    <section
      className="section-container content-section"
      id="hazard-map"
      aria-labelledby="hazard-map-title"
    >
      <span className="eyebrow">EXPLORE THE ROAD NETWORK</span>

      <h2 className="section-title" id="hazard-map-title">
        Road hazard map
      </h2>

      <p className="section-note">
        The initial view shows Delhi, not your current location.
        Only reviewer-verified reports are shown.
      </p>

      <div
        ref={mapContainerRef}
        role="region"
        aria-label="Interactive road hazard map"
        style={{
          height: '420px',
          width: '100%',
          marginTop: '24px',
          border: '1px solid #334155',
          borderRadius: '16px',
          overflow: 'hidden',
          background: '#152236',
        }}
      />

      <p className="section-note">
        Marker legend: green = low, amber = medium, red = high
        reported severity. Click a marker for text details.
      </p>

      <div role="status" aria-live="polite">
        {loadState === 'loading' && (
          <p className="section-note">Loading verified hazards…</p>
        )}

        {loadState === 'ready' && (
          <p className="section-note">
            {hazardCount === 0
              ? 'No verified hazard records are currently available.'
              : `${hazardCount} verified hazard records loaded. Pan and zoom to explore.`}
          </p>
        )}

        {loadState === 'error' && (
          <p className="section-note">
            Hazard data could not be loaded. Check your connection
            and backend server, then refresh hazards.
          </p>
        )}
      </div>

      {tilesUnavailable && (
        <p className="section-note" role="status">
          Some map tiles could not load. Check your internet connection
          and reload the page to retry.
        </p>
      )}

      <button
        className="button button-secondary"
        type="button"
        disabled={loadState === 'loading'}
        onClick={() => setRefreshCount((count) => count + 1)}
        style={{ marginTop: '16px' }}
      >
        {loadState === 'loading' ? 'Loading…' : 'Refresh hazards'}
      </button>

      <p className="section-note">
        This view loads up to 200 latest verified records.
        Missing records do not mean a road is safe.
        New or repaired hazards may not yet be reflected.
      </p>
    </section>
  )
}

export default HazardMap