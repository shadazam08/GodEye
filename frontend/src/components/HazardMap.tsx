import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { API_BASE_URL } from '../config'
import type { ReportRead, Severity } from '../types/report'
import CurrentLocation from './CurrentLocation'
import type { DeviceLocation } from './CurrentLocation'
import NearbyHazards from './NearbyHazards'
import TrackingControls from './TrackingControls'
import { useLiveLocation } from '../hooks/useLiveLocation'
import ApproachAssessmentPanel from './ApproachAssessmentPanel'
import { useTraceRecorder } from '../hooks/useTraceRecorder'
import TraceRecorderControls from './TraceRecorderControls'

import TraceMatchingPanel from './TraceMatchingPanel'
import type {
    LocationSample,
    ProviderMatchResponse,
} from '../types/mapMatching'

const severityColors: Record<Severity, string> = {
    low: '#22c55e',
    medium: '#f59e0b',
    high: '#ef4444',
}

function HazardMap() {
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const hazardLayerRef = useRef<L.LayerGroup | null>(null)
    const mapRef = useRef<L.Map | null>(null)
    const locationLayerRef = useRef<L.LayerGroup | null>(null)

    const [tilesUnavailable, setTilesUnavailable] = useState(false)
    const [loadState, setLoadState] = useState<
        'loading' | 'ready' | 'error'
    >('loading')
    const [hazardCount, setHazardCount] = useState(0)
    const [refreshCount, setRefreshCount] = useState(0)

    const [deviceLocation, setDeviceLocation] = useState<DeviceLocation | null>(null)

    const [hazards, setHazards] = useState<ReportRead[]>([])

    const trackingLayerRef = useRef<L.LayerGroup | null>(null)
    const trackingCenteredRef = useRef(false)

    const traceRecorder = useTraceRecorder()
    const matchedTraceLayerRef = useRef<L.LayerGroup | null>(null)

    const {
        position: livePosition,
        status: trackingStatus,
        error: trackingError,
        start: startTracking,
        stop: stopTracking,
    } = useLiveLocation(
        traceRecorder.recordReading,
        traceRecorder.clearSamples,
    )

    // Create the map once when the component mounts.
    useEffect(() => {
        const container = mapContainerRef.current

        if (!container) {
            return
        }

        const map = L.map(container).setView([28.6139, 77.209], 13)
        mapRef.current = map
        locationLayerRef.current = L.layerGroup().addTo(map)
        trackingLayerRef.current = L.layerGroup().addTo(map)
        matchedTraceLayerRef.current = L.layerGroup().addTo(map)

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
            locationLayerRef.current = null
            mapRef.current = null
            trackingLayerRef.current = null
            trackingCenteredRef.current = false
            matchedTraceLayerRef.current = null
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
            setHazards([])
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
                setHazards(
                    reports.filter((report) => report.status === 'verified'),
                )
                setHazardCount(hazardLayer!.getLayers().length)
                setLoadState('ready')
            } catch {
                if (active) {
                    hazardLayer!.clearLayers()
                    setHazards([])
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

    function handleLocate(location: DeviceLocation) {
        const map = mapRef.current
        const locationLayer = locationLayerRef.current

        if (!map || !locationLayer) {
            return
        }
        setDeviceLocation(location)
        locationLayer.clearLayers()

        const position: L.LatLngTuple = [
            location.latitude,
            location.longitude,
        ]

        const accuracyCircle = L.circle(position, {
            radius: location.accuracy,
            color: '#2563eb',
            weight: 1,
            fillColor: '#3b82f6',
            fillOpacity: 0.12,
            interactive: false,
        }).addTo(locationLayer)

        L.circleMarker(position, {
            radius: 8,
            color: '#ffffff',
            weight: 3,
            fillColor: '#2563eb',
            fillOpacity: 1,
        })
            .bindPopup('Your device location — a one-time reading.')
            .addTo(locationLayer)

        map.fitBounds(accuracyCircle.getBounds(), {
            padding: [24, 24],
            maxZoom: 16,
        })
    }

    useEffect(() => {
        const map = mapRef.current
        const trackingLayer = trackingLayerRef.current

        if (!map || !trackingLayer) {
            return
        }

        trackingLayer.clearLayers()

        if (!livePosition) {
            trackingCenteredRef.current = false
            matchedTraceLayerRef.current?.clearLayers()
            return
        }

        const position: L.LatLngTuple = [
            livePosition.latitude,
            livePosition.longitude,
        ]

        const accuracyCircle = L.circle(position, {
            radius: livePosition.accuracy,
            color: '#a78bfa',
            weight: 1,
            dashArray: '5 5',
            fillColor: '#a78bfa',
            fillOpacity: 0.12,
            interactive: false,
        }).addTo(trackingLayer)

        const readingTime = new Date(
            livePosition.timestamp,
        ).toLocaleTimeString()

        L.circleMarker(position, {
            radius: 9,
            color: '#ffffff',
            weight: 3,
            fillColor: '#7c3aed',
            fillOpacity: 1,
        })
            .bindPopup(`Latest tracked location reading: ${readingTime}`)
            .addTo(trackingLayer)

        // Center on the first reading; allow manual exploration afterward.
        if (!trackingCenteredRef.current) {
            map.fitBounds(accuracyCircle.getBounds(), {
                padding: [24, 24],
                maxZoom: 16,
            })

            trackingCenteredRef.current = true
        }
    }, [livePosition])

    function handleStartTracking() {
        // Remove the earlier snapshot before starting a tracked session.
        locationLayerRef.current?.clearLayers()
        setDeviceLocation(null)

        startTracking()
    }
    function handleMatchedTrace(
        result: ProviderMatchResponse,
        sourceSamples: LocationSample[],
    ) {
        const map = mapRef.current
        const resultLayer = matchedTraceLayerRef.current

        if (!map || !resultLayer) {
            return
        }

        resultLayer.clearLayers()

        const bounds = L.latLngBounds([])

        for (const sample of sourceSamples) {
            const position: L.LatLngTuple = [
                sample.latitude,
                sample.longitude,
            ]

            L.circleMarker(position, {
                radius: 4,
                color: '#475569',
                weight: 1,
                fillColor: '#cbd5e1',
                fillOpacity: 0.8,
            })
                .bindPopup('Recorded input point; not a confirmed road position.')
                .addTo(resultLayer)

            bounds.extend(position)
        }

        for (const feature of result.features) {
            for (const line of feature.geometry.coordinates) {
                const positions: L.LatLngTuple[] = line.map(
                    ([longitude, latitude]) => [latitude, longitude],
                )

                L.polyline(positions, {
                    color: '#f97316',
                    weight: 5,
                    opacity: 0.85,
                })
                    .bindPopup(
                        'Provider-matched past trace. Not a planned route or confirmed hazard approach.',
                    )
                    .addTo(resultLayer)

                for (const position of positions) {
                    bounds.extend(position)
                }
            }
        }

        if (bounds.isValid()) {
            map.fitBounds(bounds, {
                padding: [30, 30],
                maxZoom: 17,
            })
        }
    }

    function handleStartRecording() {
        matchedTraceLayerRef.current?.clearLayers()
        traceRecorder.startRecording()
    }

    function handleClearRecording() {
        matchedTraceLayerRef.current?.clearLayers()
        traceRecorder.clearSamples()
    }

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

            <TrackingControls
                position={livePosition}
                status={trackingStatus}
                error={trackingError}
                onStart={handleStartTracking}
                onStop={stopTracking}
            />

            {trackingStatus === 'tracking' && (
                <TraceRecorderControls
                    sampleCount={traceRecorder.samples.length}
                    maxSamples={traceRecorder.maxSamples}
                    isRecording={traceRecorder.isRecording}
                    onStart={handleStartRecording}
                    onStop={traceRecorder.stopRecording}
                    onClear={handleClearRecording}
                />
            )}

            {trackingStatus === 'tracking' && (
                <TraceMatchingPanel
                    samples={traceRecorder.samples}
                    isRecording={traceRecorder.isRecording}
                    onMatched={handleMatchedTrace}
                />
            )}

            {trackingStatus !== 'requesting' &&
                trackingStatus !== 'tracking' && (
                    <CurrentLocation onLocate={handleLocate} />
                )}

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
                Gray dots = submitted input points.
                Orange lines = provider-matched past trace.
                Inspect the result for incorrect snapping, parallel roads,
                and incomplete matches.
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
            <NearbyHazards
                location={
                    trackingStatus === 'requesting' ||
                        trackingStatus === 'tracking'
                        ? livePosition
                        : deviceLocation
                }
                hazards={hazards}
                loadState={loadState}
                mode={
                    trackingStatus === 'requesting' ||
                        trackingStatus === 'tracking'
                        ? 'tracking'
                        : 'snapshot'
                }
            />
            <ApproachAssessmentPanel
                position={livePosition}
                hazards={hazards}
                loadState={loadState}
            />
        </section>
    )
}

export default HazardMap