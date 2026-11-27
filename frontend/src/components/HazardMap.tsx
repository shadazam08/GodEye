import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import DestinationSearch from './DestinationSearch'
import type { Destination, RoutePlan } from '../types/navigation'
import { API_BASE_URL } from '../config'
import { useLiveLocation } from '../hooks/useLiveLocation'
import type { ReportRead, Severity } from '../types/report'
import RoutePlanner from './RoutePlanner'
import {
    assessHazardRouteOrder,
    assessRouteLocation,
    assessRouteProximity,
    projectRouteProgress,
} from '../utils/routeHazards'
import VoiceControls from './VoiceControls'
import type { VoiceControlsHandle } from './VoiceControls'
import {
    selectVoiceAlert,
    canAnnounceVoiceAlert,
} from '../utils/voiceAlerts'

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
    const voiceRef = useRef<VoiceControlsHandle | null>(null)
    const announcedReportsRef = useRef(new Set<string>())
    const lastAnnouncementRef = useRef(Number.NEGATIVE_INFINITY)
    const candidateIdRef = useRef<string | null>(null)

    const [followLocation, setFollowLocation] = useState(true)
    const [hazardsStatus, setHazardsStatus] = useState<
        'loading' | 'ready' | 'error'
    >('loading')
    const [refreshCount, setRefreshCount] = useState(0)
    const [tilesUnavailable, setTilesUnavailable] = useState(false)
    const [destination, setDestination] = useState<Destination | null>(null)
    const [route, setRoute] = useState<RoutePlan | null>(null)
    const [assessmentTime, setAssessmentTime] = useState(
        () => Date.now(),
    )

    const [hazards, setHazards] = useState<ReportRead[]>([])

    const assessedHazards = useMemo(
        () => hazards.map((report) => ({
            report,
            assessment: route
                ? assessRouteProximity(report, route.geometry)
                : null,
        })),
        [hazards, route],
    )

    const nearbyRouteCount = assessedHazards.filter(
        ({ assessment }) => assessment?.state === 'near',
    ).length

    const unavailableRouteCount = assessedHazards.filter(
        ({ assessment }) => assessment?.state === 'unavailable',
    ).length

    // Receive the latest location without recording a journey.
    const {
        position,
        status,
        error,
        start,
    } = useLiveLocation()

    const routeLocationAssessment = useMemo(
        () => route
            ? assessRouteLocation(
                position,
                route.geometry,
                assessmentTime,
                status,
            )
            : null,
        [route, position, assessmentTime, status],
    )

    const routeOrders = useMemo(() => {
        if (
            !route ||
            !position ||
            hazardsStatus !== 'ready' ||
            routeLocationAssessment?.state !== 'usable'
        ) {
            return null
        }

        const driverProgress = projectRouteProgress(
            position,
            route.geometry,
        )

        if (!driverProgress) {
            return null
        }

        return assessedHazards
            .filter(({ assessment }) => assessment?.state === 'near')
            .map(({ report }) => ({
                report,
                order: assessHazardRouteOrder(
                    position,
                    report,
                    route.geometry,
                    assessmentTime,
                    status,
                ),
            }))
    }, [
        route,
        position,
        hazardsStatus,
        routeLocationAssessment,
        assessedHazards,
        assessmentTime,
        status,
    ])

    const laterReports = routeOrders
        ? routeOrders.flatMap(({ report, order }) =>
            order.state === 'later'
                ? [{
                    report,
                    distance: order.separationAlongRouteMetres,
                }]
                : [],
        ).sort((first, second) => first.distance - second.distance)
        : []

    const uncertainReportCount = routeOrders
        ? routeOrders.filter(
            ({ order }) =>
                order.state === 'uncertain' ||
                order.state === 'blocked',
        ).length
        : 0

    const nextRouteReport = laterReports[0]

    const routeLocationMessages = {
        location_inactive: 'Live location is not active.',
        location_missing: 'Waiting for your location.',
        invalid_location: 'Waiting for a valid location reading.',
        location_stale: 'Waiting for a fresh location reading.',
        accuracy_insufficient: 'Location is too approximate for precise warnings.',
        route_unavailable: 'Route position could not be checked.',
        off_route: 'Your position appears away from the selected route.',
    }

    const routeLocationMessage = !routeLocationAssessment
        ? ''
        : routeLocationAssessment.state === 'usable'
            ? 'Location is recent and close to the route.'
            : routeLocationMessages[routeLocationAssessment.reason]

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

    useEffect(() => {
        if (!route) return

        const timer = window.setInterval(() => {
            setAssessmentTime(Date.now())
        }, 1000)

        return () => {
            window.clearInterval(timer)
        }
    }, [route])

    useEffect(() => {
        const map = mapRef.current

        if (!map || !destination) return

        const marker = L.circleMarker(
            [destination.latitude, destination.longitude],
            {
                radius: 12,
                color: '#ffffff',
                weight: 3,
                fillColor: '#a855f7',
                fillOpacity: 1,
            },
        )

        const popup = document.createElement('div')
        const title = document.createElement('strong')
        title.textContent = 'Destination'

        const address = document.createElement('p')
        address.textContent = destination.label

        popup.append(title, address)

        marker.bindPopup(popup).addTo(map)

        return () => {
            marker.remove()
        }
    }, [destination])

    function handleDestinationSelect(selected: Destination) {
        setDestination(selected)
        setFollowLocation(false)
        setRoute(null)

        const map = mapRef.current

        if (!map) return

        if (position) {
            map.fitBounds(
                [
                    [position.latitude, position.longitude],
                    [selected.latitude, selected.longitude],
                ],
                {
                    padding: [40, 40],
                    maxZoom: 16,
                },
            )
        } else {
            map.setView(
                [selected.latitude, selected.longitude],
                16,
            )
        }
    }

    function handleDestinationClear() {
        setDestination(null)
        setRoute(null)
        setFollowLocation(true)
    }

    // Load report data independently of route selection.
    useEffect(() => {
        const controller = new AbortController()
        let active = true

        const timeout = window.setTimeout(
            () => controller.abort(),
            15_000,
        )

        async function loadHazards() {
            setHazardsStatus('loading')
            setHazards([])

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/hazards?limit=200&offset=0`,
                    {
                        signal: controller.signal,
                        cache: 'no-store',
                    },
                )

                if (!response.ok) {
                    throw new Error('Could not load road reports.')
                }

                const reports: ReportRead[] = await response.json()

                if (!Array.isArray(reports)) {
                    throw new Error('Unexpected response.')
                }

                if (!active) return

                const eligible = reports.filter((report) => (
                    report &&
                    report.status === 'verified' &&
                    report.repaired_at === null &&
                    Number.isFinite(report.latitude) &&
                    Number.isFinite(report.longitude) &&
                    Math.abs(report.latitude) <= 90 &&
                    Math.abs(report.longitude) <= 180 &&
                    Object.hasOwn(severityColors, report.severity)
                ))

                setHazards(eligible)
                setHazardsStatus('ready')
            } catch {
                if (active) {
                    setHazards([])
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

    // Update markers when the report data or selected route changes.
    useEffect(() => {
        const layer = hazardsLayerRef.current

        if (!layer) return

        layer.clearLayers()

        for (const { report, assessment } of assessedHazards) {
            const nearRoute = assessment?.state === 'near'

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

            if (assessment?.state === 'near') {
                const proximity = document.createElement('p')

                proximity.textContent =
                    `Near selected route: approximately ` +
                    `${Math.round(assessment.distanceMetres)} m ` +
                    `from the route line. Same road is not confirmed.`

                popup.append(proximity)
            }

            const label = nearRoute
                ? 'Verified road damage near selected route'
                : 'Verified road damage'

            const icon = L.divIcon({
                className: 'route-hazard-icon',
                html: `
                <div class="route-hazard-marker ${nearRoute ? 'route-hazard-marker-near' : ''
                    }"
                    style="background:${severityColors[report.severity]}"
                >!</div>
            `,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
            })

            L.marker(
                [report.latitude, report.longitude],
                {
                    icon,
                    title: label,
                    alt: label,
                    zIndexOffset: nearRoute ? 500 : 0,
                },
            )
                .bindPopup(popup)
                .addTo(layer)
        }

        return () => {
            layer.clearLayers()
        }
    }, [assessedHazards])

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
            if (followLocation) {
                map.setView(coordinates, 16)
            }

            centeredRef.current = true
        } else if (followLocation) {
            map.panTo(coordinates, { animate: false })
        }
    }, [position, followLocation])

    useEffect(() => {
        const map = mapRef.current

        if (!map || !route) return

        const layer = L.layerGroup().addTo(map)
        const bounds = L.latLngBounds([])

        for (const line of route.geometry.coordinates) {
            const positions: L.LatLngTuple[] = line.map(
                ([longitude, latitude]) => [latitude, longitude],
            )

            L.polyline(positions, {
                color: '#07131e',
                weight: 10,
                opacity: 0.85,
                interactive: false,
            }).addTo(layer)

            L.polyline(positions, {
                color: '#38bdf8',
                weight: 6,
                opacity: 0.95,
                interactive: false,
            }).addTo(layer)

            for (const point of positions) {
                bounds.extend(point)
            }
        }

        if (bounds.isValid()) {
            map.fitBounds(bounds, {
                padding: [40, 40],
                maxZoom: 17,
            })
        }

        return () => {
            layer.remove()
        }
    }, [route])

    function handleRouteChange(nextRoute: RoutePlan | null) {
        setRoute(nextRoute)

        if (nextRoute) {
            setFollowLocation(false)
        }
    }

    // Reset report announcements when the planned route changes.
    useEffect(() => {
        const voice = voiceRef.current

        announcedReportsRef.current = new Set()
        candidateIdRef.current = null
        voice?.cancelReport()

        return () => {
            voice?.cancelReport()
        }
    }, [route])

    // Reassess current conditions. Do not queue future announcements.
    useEffect(() => {
        function checkForReport() {
            const now = Date.now()

            const candidate = selectVoiceAlert({
                reading: position,
                geometry: route?.geometry ?? null,
                reports: hazards,
                trackingStatus: status,
                reportsStatus: hazardsStatus,
                visible: !document.hidden,
                now,
            })

            const candidateId = candidate?.id ?? null

            if (candidateId !== candidateIdRef.current) {
                voiceRef.current?.cancelReport()
                candidateIdRef.current = candidateId
            }

            if (
                !candidate ||
                !canAnnounceVoiceAlert(
                    candidate,
                    announcedReportsRef.current,
                    lastAnnouncementRef.current,
                    now,
                )
            ) {
                return
            }

            const reportId = candidate.id
            const currentSession = announcedReportsRef.current

            voiceRef.current?.announceReport(reportId, () => {
                if (
                    document.hidden ||
                    announcedReportsRef.current !== currentSession ||
                    candidateIdRef.current !== reportId
                ) {
                    return
                }

                // Mark as announced only when speech actually starts.
                currentSession.add(reportId)
                lastAnnouncementRef.current = Date.now()
            })
        }

        const timer = window.setInterval(checkForReport, 1_000)

        document.addEventListener(
            'visibilitychange',
            checkForReport,
        )

        return () => {
            window.clearInterval(timer)

            document.removeEventListener(
                'visibilitychange',
                checkForReport,
            )
        }
    }, [route, position, status, hazardsStatus, hazards])


    useEffect(() => {
        document.body.classList.add('godeye-driver-screen')

        return () => {
            document.body.classList.remove('godeye-driver-screen')
        }
    }, [])

    // Refresh road reports while the map is visible.
    // Returning to the page also requests current report data.
    useEffect(() => {
        function refreshVisibleReports() {
            if (!document.hidden) {
                setRefreshCount((count) => count + 1)
            }
        }

        const timer = window.setInterval(
            refreshVisibleReports,
            60_000,
        )

        document.addEventListener(
            'visibilitychange',
            refreshVisibleReports,
        )

        window.addEventListener('online', refreshVisibleReports)

        return () => {
            window.clearInterval(timer)

            document.removeEventListener(
                'visibilitychange',
                refreshVisibleReports,
            )

            window.removeEventListener(
                'online',
                refreshVisibleReports,
            )
        }
    }, [])

    return (
        <section
            className="section-container content-section driver-page"
            aria-labelledby="driver-map-title"
        >
            <div className="driver-heading">
                <div>
                    <h1 id="driver-map-title">Plan your route</h1>
                </div>

                <span className="driver-heading-note">
                    Community road reports · Darbhanga
                </span>
            </div>

            <div className="driver-workspace">
                <aside
                    className="driver-sidebar"
                    aria-label="Destination and route planning"
                >

                    <DestinationSearch
                        selected={destination}
                        onSelect={handleDestinationSelect}
                        onClear={handleDestinationClear}
                    />

                    {destination ? (
                        <RoutePlanner
                            key={destination.place_id}
                            destination={destination}
                            position={position}
                            route={route}
                            onRoute={handleRouteChange}
                            onPrepareVoice={() => voiceRef.current?.activate()}
                        />
                    ) : (
                        <p className="driver-empty-route">
                            Search for a place to plan your route
                            from your current location.
                        </p>
                    )}

                    {route && (
                        <div className="route-report-summary" role="status">
                            {hazardsStatus === 'loading' ? (
                                <p>Checking road reports…</p>
                            ) : hazardsStatus === 'error' ? (
                                <p>Road report information unavailable.</p>
                            ) : (
                                <>
                                    <strong>
                                        {nearbyRouteCount === 0
                                            ? 'No nearby reports found in loaded data'
                                            : `${nearbyRouteCount} ${nearbyRouteCount === 1 ? 'report' : 'reports'
                                            } near this route`}
                                    </strong>

                                    <p>
                                        Nearby roads may be included. Reports may be incomplete.
                                    </p>

                                    {routeLocationAssessment?.state === 'usable' &&
                                        nextRouteReport && (
                                            <p>
                                                Further along planned route:{' '}
                                                <strong>
                                                    {nextRouteReport.report.location_name}
                                                </strong>
                                                {' · approximately '}
                                                {nextRouteReport.distance >= 1000
                                                    ? `${(
                                                        nextRouteReport.distance / 1000
                                                    ).toFixed(1)} km`
                                                    : `${Math.round(nextRouteReport.distance)} m`}
                                            </p>
                                        )}

                                    {(unavailableRouteCount > 0 ||
                                        uncertainReportCount > 0) && (
                                            <small>
                                                Some report positions could not be confirmed.
                                            </small>
                                        )}
                                </>
                            )}
                        </div>
                    )}
                    <VoiceControls ref={voiceRef} />
                </aside>

                <div className="driver-map-panel">
                    <div className="driver-map-status" role="status">
                        <span
                            className={`driver-status-dot ${status === 'tracking'
                                ? 'driver-status-dot-active'
                                : ''
                                }`}
                            aria-hidden="true"
                        />

                        <span>
                            {status === 'tracking'
                                ? 'Location updates on'
                                : status === 'error'
                                    ? 'Location unavailable'
                                    : status === 'stopped'
                                        ? 'Location paused'
                                        : 'Finding your location…'}
                        </span>
                        {routeLocationMessage && (
                            <span className="driver-route-location-note">
                                {routeLocationMessage}
                            </span>
                        )}
                    </div>

                    <div className="driver-map-frame">
                        <div
                            ref={containerRef}
                            className="driver-map-canvas"
                            role="region"
                            aria-label="Road damage map and your location"
                        />

                        {position && (
                            <button
                                className="driver-locate-button"
                                type="button"
                                aria-label="Center the map on my location"
                                aria-pressed={followLocation}
                                onClick={() => setFollowLocation(true)}
                            >
                                <span aria-hidden="true">◎</span>
                                My location
                            </button>
                        )}
                    </div>

                    <div className="driver-map-footer">
                        <div
                            className="driver-legend"
                            aria-label="Reported road damage severity"
                        >
                            <span><i className="legend-low" />Low</span>
                            <span><i className="legend-medium" />Medium</span>
                            <span><i className="legend-high" />High</span>
                        </div>

                        {position && status === 'tracking' && (
                            <span className="driver-accuracy">
                                Location accuracy: ~
                                {Math.round(position.accuracy)} m
                            </span>
                        )}
                    </div>

                    {status === 'error' && (
                        <div className="driver-message" role="alert">
                            <p>
                                {error || 'Could not get your location.'}
                                {' '}Allow location access in browser settings.
                            </p>
                            <button
                                className="button button-secondary"
                                type="button"
                                onClick={start}
                            >
                                Retry location
                            </button>
                        </div>
                    )}

                    {hazardsStatus === 'loading' && (
                        <p className="driver-message" role="status">
                            Loading verified road reports…
                        </p>
                    )}

                    {hazardsStatus === 'error' && (
                        <div className="driver-message" role="alert">
                            <p>Road damage information could not be loaded.</p>
                            <button
                                className="button button-secondary"
                                type="button"
                                onClick={() =>
                                    setRefreshCount((count) => count + 1)
                                }
                            >
                                Retry road reports
                            </button>
                        </div>
                    )}

                    {tilesUnavailable && (
                        <p className="driver-message" role="status">
                            Some map tiles could not load.
                            Check your connection.
                        </p>
                    )}
                </div>
            </div>
        </section>
    )
}

export default HazardMap