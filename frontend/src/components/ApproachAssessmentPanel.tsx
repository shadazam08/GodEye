import { useEffect, useState } from 'react'

import type { LivePosition } from '../hooks/useLiveLocation'
import type { ReportRead } from '../types/report'
import {
    APPROACH_LIMITS,
    assessHazardApproach,
    distanceInMetres,
} from '../utils/geo'

interface ApproachAssessmentPanelProps {
    position: LivePosition | null
    hazards: ReportRead[]
    loadState: 'loading' | 'ready' | 'error'
}

function ApproachAssessmentPanel({
    position,
    hazards,
    loadState,
}: ApproachAssessmentPanelProps) {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        if (!position) {
            return
        }

        const timer = window.setInterval(() => {
            setNow(Date.now())
        }, 1000)

        return () => {
            window.clearInterval(timer)
        }
    }, [position])

    if (!position) {
        return null
    }

    if (loadState !== 'ready') {
        return (
            <div className="nearby-hazards">
                <h3>Approach assessment</h3>
                <p className="section-note" role="status">
                    {loadState === 'loading'
                        ? 'Waiting for hazard data.'
                        : 'Assessment unavailable because hazard data could not load.'}
                </p>
            </div>
        )
    }

    const assessments = hazards
        .filter((hazard) => hazard.status === 'verified')
        .map((hazard) => ({
            hazard,
            distance: distanceInMetres(position, hazard),
            assessment: assessHazardApproach(
                position,
                hazard,
                now,
            ),
        }))
        .sort((first, second) => first.distance - second.distance)

    const candidates = assessments.filter(
        ({ assessment }) => assessment.state === 'candidate',
    )

    const blockedReasons = Array.from(
        new Set(
            assessments.flatMap(({ assessment }) =>
                assessment.state === 'blocked'
                    ? [assessment.reason]
                    : [],
            ),
        ),
    )

    return (
        <div className="nearby-hazards">
            <h3>Approach assessment</h3>

            <p className="section-note">
                Development assessment only. Road matching has not been
                performed, so candidates do not establish a pothole ahead.
            </p>

            <p className="section-note" role="status">
                {candidates.length} approach candidates among{' '}
                {assessments.length} loaded verified records.
            </p>

            {assessments.length === 0 && (
                <p className="section-note">
                    No verified records are available for assessment.
                </p>
            )}

            {candidates.length > 0 && (
                <ul className="nearby-hazards-list">
                    {candidates.slice(0, 5).map(({ hazard, assessment }) => (
                        <li className="info-card" key={hazard.id}>
                            <span className="feature-tag">
                                Candidate — road match required
                            </span>

                            <h3>{hazard.title}</h3>

                            {assessment.state === 'candidate' && (
                                <>
                                    <p>
                                        Coordinate distance: approximately{' '}
                                        {Math.round(assessment.distanceMetres)} metres
                                    </p>
                                    <p>
                                        Heading difference: approximately{' '}
                                        {Math.round(assessment.headingDifferenceDegrees)}°
                                    </p>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {blockedReasons.length > 0 && (
                <div>
                    <h4>Reasons records were excluded</h4>

                    <ul>
                        {blockedReasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                        ))}
                    </ul>

                    <p className="section-note">
                        Each record reports its first failed check. Other checks
                        may also fail.
                    </p>
                </div>
            )}

            <p className="section-note">
                Initial development settings: reading age up to{' '}
                {APPROACH_LIMITS.maxReadingAgeMs / 1000} seconds,
                accuracy radius up to {APPROACH_LIMITS.maxAccuracyMetres} metres,
                assessment radius {APPROACH_LIMITS.maxDistanceMetres} metres,
                minimum reported speed{' '}
                {APPROACH_LIMITS.minSpeedMetresPerSecond} m/s,
                heading difference up to{' '}
                {APPROACH_LIMITS.maxHeadingDifferenceDegrees}°.
                These are not validated safety thresholds.
            </p>
        </div>
    )
}

export default ApproachAssessmentPanel