import { useEffect, useState } from 'react'

import type { DeviceLocation } from './CurrentLocation'
import type { ReportRead } from '../types/report'
import { distanceInMetres } from '../utils/geo'

interface NearbyHazardsProps {
    location: DeviceLocation | null
    hazards: ReportRead[]
    loadState: 'loading' | 'ready' | 'error'
    mode?: 'snapshot' | 'tracking'
}

function formatDistance(distance: number): string {
    if (distance < 10) {
        return 'Under 10 metres between coordinates'
    }

    if (distance < 1000) {
        return `Approximately ${Math.round(distance / 10) * 10} metres`
    }

    return `Approximately ${(distance / 1000).toFixed(1)} km`
}

function NearbyHazards({
    location,
    hazards,
    loadState,
    mode = 'snapshot',
}: NearbyHazardsProps) {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        if (mode !== 'tracking' || !location) {
            return
        }

        const timer = window.setInterval(() => {
            setNow(Date.now())
        }, 1000)

        return () => {
            window.clearInterval(timer)
        }
    }, [mode, location])

    if (!location) {
        return (
            <p className="section-note" role="status">
                {mode === 'tracking'
                    ? 'Waiting for a device location reading to calculate distances…'
                    : 'Select “Show my location” to calculate a distance snapshot.'}
            </p>
        )
    }

    if (loadState === 'loading') {
        return (
            <p className="section-note" role="status">
                Loading hazard records before calculating distances…
            </p>
        )
    }

    if (loadState === 'error') {
        return (
            <p className="section-note" role="status">
                Distances are unavailable because hazard data could not load.
                Refresh hazards to retry.
            </p>
        )
    }

    const readingIsOld =
        mode === 'tracking' &&
        now - location.timestamp > 15000

    if (readingIsOld) {
        return (
            <div className="nearby-hazards" role="status">
                <h3>Waiting for a newer location reading</h3>
                <p className="section-note">
                    Live distance estimates are hidden because the last
                    reading is over 15 seconds old.
                </p>
            </div>
        )
    }

    const nearestHazards = hazards
        .filter((hazard) => hazard.status === 'verified')
        .map((hazard) => ({
            hazard,
            distance: distanceInMetres(location, hazard),
        }))
        .sort((first, second) => first.distance - second.distance)
        .slice(0, 5)

    return (
        <div className="nearby-hazards">
            <h3>
                {mode === 'tracking'
                    ? 'Distances from latest tracked reading'
                    : 'Distance snapshot'}
            </h3>

            <p className="section-note">
                Based on the location reading taken at{' '}
                {new Date(location.timestamp).toLocaleTimeString()}.{' '}
                {mode === 'tracking'
                    ? 'Distances recalculate when a new device reading arrives.'
                    : 'These distances do not update as you move.'}
            </p>

            {nearestHazards.length === 0 ? (
                <p className="section-note">
                    No verified hazards are available in the loaded records.
                    This does not establish that nearby roads are safe.
                </p>
            ) : (
                <ol className="nearby-hazards-list">
                    {nearestHazards.map(({ hazard, distance }) => (
                        <li className="info-card" key={hazard.id}>
                            <span className="feature-tag">
                                {hazard.severity} reported severity
                            </span>

                            <h3>{hazard.title}</h3>
                            <p>{hazard.location_name}</p>
                            <p>{formatDistance(distance)}</p>
                        </li>
                    ))}
                </ol>
            )}

            <p className="section-note">
                Shows up to five nearest hazards among the loaded records,
                not a complete search of surrounding roads. Distances are
                direct geographic estimates, not road travel distances.
            </p>

            <p className="section-note">
                The reading has a browser-reported accuracy radius of
                approximately {Math.ceil(location.accuracy)} metres.
                Neither travel direction nor road matching has been checked.
            </p>
        </div>
    )
}

export default NearbyHazards