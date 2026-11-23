import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { matchReviewerTrace } from '../api/reviewer'
import type {
    LocationSample,
    ProviderMatchResponse,
} from '../types/mapMatching'

interface TraceMatchingPanelProps {
    samples: LocationSample[]
    isRecording: boolean
    onMatched: (
        result: ProviderMatchResponse,
        sourceSamples: LocationSample[],
    ) => void
}

function TraceMatchingPanel({
    samples,
    isRecording,
    onMatched,
}: TraceMatchingPanelProps) {
    const mountedRef = useRef(true)
    const submittingRef = useRef(false)
    const traceRef = useRef({ samples, isRecording })

    const [reviewerKey, setReviewerKey] = useState('')
    const [consented, setConsented] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    useEffect(() => {
        traceRef.current = { samples, isRecording }
    }, [samples, isRecording])

    useEffect(() => {
        mountedRef.current = true

        return () => {
            mountedRef.current = false
        }
    }, [])

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (submittingRef.current) {
            return
        }

        setError('')
        setNotice('')

        if (isRecording || samples.length < 2) {
            setError('Stop recording after collecting at least two points.')
            return
        }

        if (!reviewerKey.trim() || !consented) {
            setError('Reviewer access and upload consent are required.')
            return
        }

        const sourceSamples = samples

        const payloadSamples = samples.map((sample) => ({
            ...sample,
        }))

        submittingRef.current = true
        setIsSubmitting(true)

        try {
            const result = await matchReviewerTrace(
                reviewerKey.trim(),
                {
                    mode: 'drive',
                    samples: payloadSamples,
                },
            )

            if (!mountedRef.current) {
                return
            }

            if (
                traceRef.current.samples !== sourceSamples ||
                traceRef.current.isRecording
            ) {
                setError(
                    'The collected trace changed during the request. ' +
                    'The returned result was not applied.',
                )
                return
            }

            onMatched(result, payloadSamples)

            setNotice(
                `Received ${result.features.length} route feature(s). ` +
                'Inspect the result; this does not confirm a hazard ahead.',
            )

            setReviewerKey('')
            setConsented(false)
        } catch (caughtError) {
            if (mountedRef.current) {
                setError(
                    caughtError instanceof Error
                        ? caughtError.message
                        : 'Could not complete road matching.',
                )
            }
        } finally {
            submittingRef.current = false

            if (mountedRef.current) {
                setIsSubmitting(false)
            }
        }
    }

    const canSubmit =
        !isRecording &&
        samples.length >= 2 &&
        Boolean(reviewerKey.trim()) &&
        consented &&
        !isSubmitting

    return (
        <div className="tracking-panel">
            <h3>Send collected points for road matching</h3>

            <p className="section-note">
                Reviewer diagnostic access only. Stop recording first.
                This request uses the driving travel mode.
            </p>

            <p className="section-note">
                Available points: {samples.length}.
                No request is sent until you select consent and submit.
            </p>
            {isRecording ? (
                <p className="section-note" role="status">
                    Recording is active. Stop recording before submitting.
                </p>
            ) : samples.length < 2 ? (
                <p className="section-note" role="status">
                    At least two separate location readings are required.
                    Currently available: {samples.length}. Resume collection
                    by starting a new recording; this clears the previous trace.
                    A stationary device may provide updates infrequently.
                </p>
            ) : null}

            <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
                <div className="form-field" style={{ marginTop: '20px' }}>
                    <label htmlFor="trace-reviewer-key">Reviewer key</label>

                    <input
                        id="trace-reviewer-key"
                        type="password"
                        value={reviewerKey}
                        onChange={(event) => setReviewerKey(event.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                        disabled={isSubmitting}
                        required
                    />
                </div>

                <label
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        marginBlock: '20px',
                        lineHeight: 1.7,
                        fontSize: '14px',
                    }}
                >
                    <input
                        type="checkbox"
                        checked={consented}
                        onChange={(event) => setConsented(event.target.checked)}
                        disabled={isSubmitting}
                        required
                    />

                    <span>
                        I agree to send the collected coordinates, timestamps,
                        accuracy values, and available headings to the GodEye
                        backend. It forwards coordinates, timestamps, and available
                        headings to Geoapify for road matching. This consumes
                        provider credits.
                    </span>
                </label>

                <button
                    className="button button-primary"
                    type="submit"
                    disabled={!canSubmit}
                >
                    {isSubmitting ? 'Matching collected points…' : 'Match collected points'}
                </button>
            </form>

            {notice && (
                <p className="form-message form-message-success" role="status">
                    {notice}
                </p>
            )}

            {error && (
                <p className="form-message form-message-error" role="alert">
                    {error}
                </p>
            )}

            <p className="section-note">
                Matching is manual and is not automatically retried.
                Clearing local points cannot recall data already submitted.
            </p>

            <p className="section-note">
                Powered by{' '}
                <a
                    href="https://www.geoapify.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'underline' }}
                >
                    Geoapify
                </a>
                . Road data © OpenStreetMap contributors.
            </p>
        </div>
    )
}

export default TraceMatchingPanel