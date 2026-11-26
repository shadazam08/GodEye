import { useEffect, useState } from "react";

import type {
    LivePosition,
    TrackingStatus,
} from "../hooks/useLiveLocation";

interface TrackingControlsProps {
    position: LivePosition | null;
    status: TrackingStatus;
    error: string;
    onStart: () => void;
    onStop: () => void;
}

function TrackingControls({
    position,
    status,
    error,
    onStart,
    onStop,
}: TrackingControlsProps) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => window.clearInterval(timer);
    }, []);

    const isActive =
        status === "requesting" || status === "tracking";

    const isStale =
        position !== null && now - position.timestamp > 15000;

    let message = "Finding your location…";

    if (status === "tracking" && position) {
        message = isStale
            ? "Waiting for a fresh location update…"
            : "Your location updates automatically";
    } else if (status === "stopped") {
        message = "Location updates are paused";
    } else if (status === "error") {
        message = "Location is unavailable";
    }

    return (
        <div className="live-location-bar">
            <div>
                <p className="live-location-title" role="status">
                    <span aria-hidden="true">📍 </span>
                    {message}
                </p>

                {position && !isStale && (
                    <p className="live-location-detail">
                        Location accuracy: approximately{" "}
                        {Math.ceil(position.accuracy)} metres
                    </p>
                )}

                {error && (
                    <p className="form-message" role="alert">
                        {error}
                    </p>
                )}
            </div>

            <div className="live-location-actions">
                {(status === "error" || status === "stopped") && (
                    <button
                        className="button button-primary"
                        type="button"
                        onClick={onStart}
                    >
                        {status === "error" ? "Try again" : "Enable location"}
                    </button>
                )}

                {isActive && (
                    <button
                        className="button button-secondary"
                        type="button"
                        onClick={onStop}
                    >
                        Pause location
                    </button>
                )}
            </div>
        </div>
    );
}

export default TrackingControls;