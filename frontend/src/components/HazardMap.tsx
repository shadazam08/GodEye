import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { API_BASE_URL } from '../config'
import { useLiveLocation } from '../hooks/useLiveLocation'
import type { ReportRead, Severity } from '../types/report'

const severityColors: Record<Severity, string> = {
    low: '#22c55e',
    medium: '#f59e0b',
    high: '#ef4444',
}

function HazardMap() {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<L.Map | null>(null)
    const hazardsLayerRef = useRef<L.LayerGroup | null>(null)
    const locationLayerRef = useRef<L.LayerGroup | null>(null)
    const centeredRef = useRef(false)

    const [followLocation, setFollowLocation] = useState(true)
    const [hazardsStatus, setHazardsStatus] = useState<
        'loading' | 'ready' | 'error'
    >('loading')
    const [refreshCount, setRefreshCount] = useState(0)
    const [tilesUnavailable, setTilesUnavailable] = useState(false)

    // Receive the latest location without recording a journey.
    const {
        position,
        status,
        error,
        start,
    } = useLiveLocation()

    // Open the map with Darbhanga as the initial view.
    useEffect(() => {
        if (!containerRef.current) return

        const map = L.map(containerRef.current).setView(
            [26.1542, 85.8918],
            13,
        )

        mapRef.current = map
        hazardsLayerRef.current = L.layerGroup().addTo(map)
        locationLayerRef.current = L.layerGroup().addTo(map)

        const tiles = L.tileLayer(
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
                attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            },
        )

        function handleTileError() {
            setTilesUnavailable(true)
        }

        function handleMapDrag() {
            // Let the user explore without snapping back immediately.
            setFollowLocation(false)
        }

        tiles.on('tileerror', handleTileError)
        tiles.addTo(map)
        map.on('dragstart', handleMapDrag)

        const observer = new ResizeObserver(() => {
            map.invalidateSize()
        })

        observer.observe(containerRef.current)

        return () => {
            observer.disconnect()
            tiles.off('tileerror', handleTileError)
            map.off('dragstart', handleMapDrag)
            map.remove()

            mapRef.current = null
            hazardsLayerRef.current = null
            locationLayerRef.current = null
            centeredRef.current = false
        }
    }, [])

    // Request location automatically when the map opens.
    // Resume automatically when the user returns to this tab.
    useEffect(() => {
        let timer: number | undefined

        function requestLocation() {
            if (timer !== undefined) {
                window.clearTimeout(timer)
            }

            if (!document.hidden) {
                timer = window.setTimeout(() => {
                    start()
                }, 0)
            }
        }

        requestLocation()

        document.addEventListener(
            'visibilitychange',
            requestLocation,
        )

        return () => {
            if (timer !== undefined) {
                window.clearTimeout(timer)
            }

            document.removeEventListener(
                'visibilitychange',
                requestLocation,
            )
        }
    }, [start])

    // Load verified road damage independently of location permission.
    useEffect(() => {
        const layer = hazardsLayerRef.current

        if (!layer) return

        const controller = new AbortController()
        let active = true

        const timeout = window.setTimeout(() => {
            controller.abort()
        }, 15_000)

        async function loadHazards() {
            setHazardsStatus('loading')

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/hazards?limit=200&offset=0`,
                    {
                        signal: controller.signal,
                        cache: 'no-store',
                    },
                )

                if (!response.ok) {
                    throw new Error('Could not load road damage.')
                }

                const reports: ReportRead[] = await response.json()

                if (!Array.isArray(reports)) {
                    throw new Error('Unexpected response.')
                }

                if (!active) return

                layer!.clearLayers()

                for (const report of reports) {
                    if (
                        report.status !== 'verified' ||
                        !Number.isFinite(report.latitude) ||
                        !Number.isFinite(report.longitude) ||
                        Math.abs(report.latitude) > 90 ||
                        Math.abs(report.longitude) > 180 ||
                        !Object.hasOwn(severityColors, report.severity)
                    ) {
                        continue
                    }

                    const popup = document.createElement('div')

                    const title = document.createElement('strong')
                    title.textContent = report.title

                    const description = document.createElement('p')
                    description.textContent = report.description

                    const details = document.createElement('p')
                    details.textContent =
                        `${report.location_name} · ` +
                        `Reported severity: ${report.severity}`

                    popup.append(title, description, details)

                    const icon = L.divIcon({
                        className: '',
                        html: `
              <div style="
                width:32px;
                height:32px;
                display:grid;
                place-items:center;
                border:2px solid white;
                border-radius:50%;
                background:${severityColors[report.severity]};
                color:#111827;
                font-size:23px;
                font-weight:900;
              ">!</div>
            `,
                        iconSize: [32, 32],
                        iconAnchor: [16, 16],
                    })

                    L.marker(
                        [report.latitude, report.longitude],
                        {
                            icon,
                            title: 'Verified road damage',
                            alt: 'Verified road damage',
                        },
                    )
                        .bindPopup(popup)
                        .addTo(layer!)
                }

                setHazardsStatus('ready')
            } catch {
                if (active) {
                    layer!.clearLayers()
                    setHazardsStatus('error')
                }
            } finally {
                window.clearTimeout(timeout)
            }
        }

        void loadHazards()

        return () => {
            active = false
            controller.abort()
            window.clearTimeout(timeout)
        }
    }, [refreshCount])

    // Replace the previous location marker with the latest reading.
    useEffect(() => {
        const map = mapRef.current
        const layer = locationLayerRef.current

        if (!map || !layer) return

        layer.clearLayers()

        if (!position) return

        const coordinates: L.LatLngTuple = [
            position.latitude,
            position.longitude,
        ]

        L.circle(coordinates, {
            radius: position.accuracy,
            color: '#2563eb',
            weight: 1,
            fillColor: '#3b82f6',
            fillOpacity: 0.12,
            interactive: false,
        }).addTo(layer)

        L.circleMarker(coordinates, {
            radius: 10,
            color: '#ffffff',
            weight: 3,
            fillColor: '#2563eb',
            fillOpacity: 1,
        })
            .bindPopup('Your latest device location')
            .addTo(layer)

        if (!centeredRef.current) {
            map.setView(coordinates, 16)
            centeredRef.current = true
        } else if (followLocation) {
            map.panTo(coordinates, { animate: false })
        }
    }, [position, followLocation])

    return (
        <section
            className="section-container content-section"
            aria-labelledby="driver-map-title"
        >
            <h1 className="section-title" id="driver-map-title">
                Road map
            </h1>

            <div role="status" aria-live="polite">
                {(status === 'idle' || status === 'requesting') && (
                    <p className="section-note">
                        Finding your location. Allow location access if
                        your browser asks.
                    </p>
                )}

                {status === 'tracking' && position && (
                    <p className="section-note">
                        Location updates are on.
                        {' '}
                        Last reading:{' '}
                        {new Date(position.timestamp).toLocaleTimeString()}
                        {' · '}
                        Estimated accuracy: {Math.round(position.accuracy)} m
                    </p>
                )}

                {status === 'stopped' && (
                    <p className="section-note">
                        Location updates are paused.
                    </p>
                )}
            </div>

            {status === 'error' && (
                <div className="form-message" role="alert">
                    <p>{error}</p>

                    <p>
                        If location is blocked, allow it in your browser
                        site settings.
                    </p>

                    <button
                        className="button button-primary"
                        type="button"
                        onClick={start}
                    >
                        Try location again
                    </button>
                </div>
            )}

            <div
                ref={containerRef}
                role="region"
                aria-label="Road damage map and your location"
                style={{
                    height: 'clamp(350px, 62dvh, 700px)',
                    width: '100%',
                    marginTop: '16px',
                    border: '1px solid #334155',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    background: '#152236',
                }}
            />

            {position && !followLocation && (
                <button
                    className="button button-primary"
                    type="button"
                    style={{ marginTop: '12px' }}
                    onClick={() => setFollowLocation(true)}
                >
                    Follow my location
                </button>
            )}

            <p className="section-note">
                🔵 Your location
                {' · '}
                🟢 Low severity
                {' · '}
                🟠 Medium severity
                {' · '}
                🔴 High severity
            </p>

            {hazardsStatus === 'loading' && (
                <p className="section-note" role="status">
                    Loading verified road damage…
                </p>
            )}

            {hazardsStatus === 'error' && (
                <div role="alert">
                    <p>Road damage information could not be loaded.</p>

                    <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => setRefreshCount((count) => count + 1)}
                    >
                        Retry loading road damage
                    </button>
                </div>
            )}

            {tilesUnavailable && (
                <p className="section-note" role="status">
                    Some map tiles could not load. Check your connection.
                </p>
            )}
            <p className="section-note">
                Road damage reports may be incomplete.
            </p>
        </section>
    )
}

export default HazardMap