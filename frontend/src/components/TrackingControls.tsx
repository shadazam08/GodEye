import type {
    LivePosition,
    TrackingStatus,
} from '../hooks/useLiveLocation'
import { useEffect, useState } from 'react'

interface TrackingControlsProps {
    position: LivePosition | null
    status: TrackingStatus
    error: string
    onStart: () => void
    onStop: () => void
}

const statusLabels: Record<TrackingStatus, string> = {
    idle: 'Not started',
    requesting: 'Waiting for a location reading',
    tracking: 'Receiving location readings',
    stopped: 'Stopped',
    error: 'Location tracking unavailable',
}

function TrackingControls({
    position,
    status,
    error,
    onStart,
    onStop,
}: TrackingControlsProps) {
    const isActive =
        status === 'requesting' || status === 'tracking'
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        if (!isActive) {
            return
        }

        const timer = window.setInterval(() => {
            setNow(Date.now())
        }, 1000)

        return () => {
            window.clearInterval(timer)
        }
    }, [isActive])

    const readingAgeSeconds = position
        ? Math.max(0, Math.floor((now - position.timestamp) / 1000))
        : null

    const readingIsOld =
        readingAgeSeconds !== null && readingAgeSeconds > 15

    return (
        <div className="tracking-panel">
            <h3>Active-session location tracking</h3>

            <p className="section-note">
                Start only while stationary or as a passenger. Keep this tab
                visible. Tracking stops when the tab becomes hidden and must
                be started again manually.
            </p>

            <div className="reviewer-toolbar">
                <button
                    className="button button-primary"
                    type="button"
                    onClick={onStart}
                    disabled={isActive}
                >
                    Start tracking
                </button>

                <button
                    className="button button-secondary"
                    type="button"
                    onClick={onStop}
                    disabled={!isActive}
                >
                    Stop tracking
                </button>
            </div>

            <p className="section-note" role="status">
                Tracking status:{' '}
                {status === 'tracking' && readingIsOld
                    ? 'Waiting for a newer location reading'
                    : statusLabels[status]}
            </p>

            {position && (
                <dl className="tracking-details">
                    <div>
                        <dt>Latest coordinates</dt>
                        <dd>
                            {position.latitude.toFixed(6)},{' '}
                            {position.longitude.toFixed(6)}
                        </dd>
                    </div>

                    <div>
                        <dt>Reported accuracy radius</dt>
                        <dd>
                            Approximately {Math.ceil(position.accuracy)} metres
                        </dd>
                    </div>

                    <div>
                        <dt>Device-reported speed</dt>
                        <dd>
                            {position.speed === null
                                ? 'Unavailable'
                                : `${(position.speed * 3.6).toFixed(1)} km/h`}
                        </dd>
                    </div>

                    <div>
                        <dt>Device-reported travel direction</dt>
                        <dd>
                            {position.heading === null
                                ? 'Unavailable'
                                : `${Math.round(position.heading) % 360}° clockwise from north`}
                        </dd>
                    </div>

                    <div>
                        <dt>Latest reading time</dt>
                        <dd>
                            {new Date(position.timestamp).toLocaleTimeString()}
                        </dd>
                    </div>

                    <div>
                        <dt>Reading age</dt>
                        <dd>
                            {readingAgeSeconds === null
                                ? 'Unavailable'
                                : `${readingAgeSeconds} seconds`}
                        </dd>
                    </div>
                </dl>
            )}

            {position && readingIsOld && (
                <p className="section-note" role="status">
                    The last reading is over 15 seconds old. The displayed
                    position may no longer reflect your location.
                </p>
            )}

            {error && (
                <p className="form-message form-message-error" role="alert">
                    {error}
                </p>
            )}

            <p className="section-note">
                Browser updates may be delayed or inaccurate. This feature
                does not yet provide road-matched pothole warnings.
            </p>
        </div>
    )
}

export default TrackingControls