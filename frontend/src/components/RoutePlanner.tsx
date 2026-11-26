import { useEffect, useRef, useState } from 'react'

import { getDrivingRoute } from '../api/navigation'
import type { LivePosition } from '../hooks/useLiveLocation'
import type {
    Destination,
    RoutePlan,
    TravelMode,
} from '../types/navigation'

type Props = {
    destination: Destination
    position: LivePosition | null
    route: RoutePlan | null
    onRoute: (route: RoutePlan | null) => void
    onPrepareVoice?: () => void
}

export default function RoutePlanner({
    destination,
    position,
    route,
    onRoute,
    onPrepareVoice,
}: Props) {
    const [mode, setMode] = useState<TravelMode>('drive')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const mountedRef = useRef(false)
    const busyRef = useRef(false)
    const requestRef = useRef(0)
    const controllerRef = useRef<AbortController | null>(null)
    const [settingsOpen, setSettingsOpen] = useState(false)

    useEffect(() => {
        mountedRef.current = true

        return () => {
            mountedRef.current = false
            requestRef.current += 1
            controllerRef.current?.abort()
        }
    }, [])

    async function showRoute() {
        if (busyRef.current) return

        setError('')

        if (!position) {
            setError('Waiting for your current location.')
            return
        }

        const now = Date.now()

        if (
            !Number.isFinite(position.timestamp) ||
            position.timestamp > now ||
            now - position.timestamp > 30_000
        ) {
            setError('Waiting for a newer location reading. Please try again.')
            return
        }

        const payload = {
            start: {
                latitude: position.latitude,
                longitude: position.longitude,
            },
            destination: {
                latitude: destination.latitude,
                longitude: destination.longitude,
            },
            mode,
        }

        onPrepareVoice?.()
        busyRef.current = true
        setLoading(true)
        onRoute(null)

        const requestId = ++requestRef.current
        const controller = new AbortController()
        controllerRef.current = controller

        const timeout = window.setTimeout(
            () => controller.abort(),
            30_000,
        )

        try {
            const result = await getDrivingRoute(
                payload,
                controller.signal,
            )

            if (
                !mountedRef.current ||
                requestRef.current !== requestId
            ) {
                return
            }

            onRoute(result)
            setSettingsOpen(false)
        } catch (caught) {
            if (
                mountedRef.current &&
                requestRef.current === requestId
            ) {
                setError(
                    controller.signal.aborted
                        ? 'Route planning timed out. Please try again.'
                        : caught instanceof Error
                            ? caught.message
                            : 'Could not calculate the route.',
                )
            }
        } finally {
            window.clearTimeout(timeout)

            if (
                mountedRef.current &&
                requestRef.current === requestId
            ) {
                busyRef.current = false
                controllerRef.current = null
                setLoading(false)
            }
        }
    }

    return (
        <div className="route-planner">
            {route && (
                <div className="journey-summary" role="status">
                    <div className="journey-summary-main">
                        <strong>
                            {(route.distance_m / 1000).toFixed(1)} km
                        </strong>

                        <span>
                            ~{Math.max(
                                1,
                                Math.ceil(route.duration_s / 60),
                            )} min
                        </span>

                        <span className="journey-vehicle">
                            {mode === 'drive' ? 'Car' : 'Bike'}
                        </span>
                    </div>

                    <button
                        className="destination-change"
                        type="button"
                        aria-expanded={settingsOpen}
                        onClick={() => setSettingsOpen((value) => !value)}
                    >
                        {settingsOpen ? 'Close vehicle options' : 'Change vehicle'}
                    </button>
                </div>
            )}

            {(!route || settingsOpen) && (
                <div className="journey-settings">
                    <fieldset
                        className="vehicle-options"
                        disabled={loading}
                    >
                        <legend>Vehicle</legend>

                        <label>
                            <input
                                type="radio"
                                name="journey-vehicle"
                                value="drive"
                                checked={mode === 'drive'}
                                onChange={() => {
                                    setMode('drive')
                                    setError('')
                                    onRoute(null)
                                }}
                            />
                            <span>Car</span>
                        </label>

                        <label>
                            <input
                                type="radio"
                                name="journey-vehicle"
                                value="motorcycle"
                                checked={mode === 'motorcycle'}
                                onChange={() => {
                                    setMode('motorcycle')
                                    setError('')
                                    onRoute(null)
                                }}
                            />
                            <span>Bike</span>
                        </label>
                    </fieldset>

                    <button
                        className="button button-primary"
                        type="button"
                        disabled={loading || !position}
                        onClick={() => void showRoute()}
                    >
                        {loading
                            ? 'Finding route…'
                            : route
                                ? 'Update route'
                                : 'Show route'}
                    </button>

                    {!position && (
                        <p className="section-note" role="status">
                            Waiting for your location…
                        </p>
                    )}
                </div>
            )}

            {error && (
                <p
                    className="form-message form-message-error"
                    role="alert"
                >
                    {error}
                </p>
            )}

            {route && (
                <small className="route-attribution">
                    {route.attribution ||
                        'Routing: Geoapify · © OpenStreetMap contributors'}
                </small>
            )}
        </div>
    )
}