interface TraceRecorderControlsProps {
    sampleCount: number
    maxSamples: number
    isRecording: boolean
    onStart: () => void
    onStop: () => void
    onClear: () => void
}

function TraceRecorderControls({
    sampleCount,
    maxSamples,
    isRecording,
    onStart,
    onStop,
    onClear,
}: TraceRecorderControlsProps) {
    return (
        <div className="tracking-panel">
            <h3>Record a trace for road-matching review</h3>

            <p className="section-note">
                Recording collects location readings in this page’s memory.
                Starting a new recording clears the previous trace.
                Nothing is uploaded by these controls.
            </p>

            <div className="reviewer-toolbar">
                <button
                    className="button button-primary"
                    type="button"
                    onClick={onStart}
                    disabled={isRecording}
                >
                    Start recording points
                </button>

                <button
                    className="button button-secondary"
                    type="button"
                    onClick={onStop}
                    disabled={!isRecording}
                >
                    Stop recording points
                </button>

                <button
                    className="button button-secondary"
                    type="button"
                    onClick={onClear}
                    disabled={!isRecording && sampleCount === 0}
                >
                    Clear collected points
                </button>
            </div>

            <p className="section-note" role="status">
                Recording: {isRecording ? 'On' : 'Off'}. Collected points:{' '}
                {sampleCount} / {maxSamples}.
            </p>

            <p className="section-note">
                Only the latest {maxSamples} readings are retained.
                Duplicate or out-of-order timestamps are ignored.
                Repeated coordinates can still represent separate readings;
                point count alone does not prove movement.
            </p>

            <p className="section-note">
                Stopping recording preserves the collected points.
                Stopping location tracking, hiding this tab, or starting
                a new tracking session clears them.
            </p>
        </div>
    )
}

export default TraceRecorderControls