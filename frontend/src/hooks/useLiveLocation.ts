import { useCallback, useEffect, useRef, useState } from "react";

import type { DeviceLocation } from "../components/CurrentLocation";

export interface LivePosition extends DeviceLocation {
  speed: number | null;
  heading: number | null;
}

export type TrackingStatus = "idle" | "requesting" | "tracking" | "stopped" | "error";

export function useLiveLocation(onReading?: (reading: LivePosition) => void, onSessionReset?: () => void) {
  const watchIdRef = useRef<number | null>(null);
  const sessionRef = useRef(0);

  const onReadingRef = useRef(onReading);
  const onSessionResetRef = useRef(onSessionReset);

  const [position, setPosition] = useState<LivePosition | null>(null);
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    onReadingRef.current = onReading;
    onSessionResetRef.current = onSessionReset;
  }, [onReading, onSessionReset]);

  const clearWatch = useCallback(() => {
    sessionRef.current += 1;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearWatch();
    onSessionResetRef.current?.();

    setPosition(null);
    setStatus("stopped");
    setError("");
  }, [clearWatch]);

  const start = useCallback(() => {
    clearWatch();
    onSessionResetRef.current?.();

    setPosition(null);
    setError("");

    if (!window.isSecureContext || !navigator.geolocation) {
      setStatus("error");
      setError("Location tracking requires a supported browser and HTTPS or localhost.");
      return;
    }

    if (document.hidden) {
      setStatus("error");
      setError("Keep this tab visible before starting tracking.");
      return;
    }

    const session = sessionRef.current;
    setStatus("requesting");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (reading) => {
        if (session !== sessionRef.current) {
          return;
        }

        const { coords } = reading;

        const speed = coords.speed !== null && Number.isFinite(coords.speed) && coords.speed >= 0 ? coords.speed : null;

        const heading =
          coords.heading !== null && Number.isFinite(coords.heading) && coords.heading >= 0 && coords.heading < 360
            ? coords.heading
            : null;

        const nextPosition: LivePosition = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          timestamp: reading.timestamp,
          speed,
          heading,
        };

        setPosition(nextPosition);
        setStatus("tracking");

        onReadingRef.current?.(nextPosition);
      },
      (locationError) => {
        if (session !== sessionRef.current) {
          return;
        }

        clearWatch();
        onSessionResetRef.current?.();

        setPosition(null);
        setStatus("error");

        switch (locationError.code) {
          case 1:
            setError("Location permission was denied.");
            break;

          case 2:
            setError("Device location is currently unavailable.");
            break;

          case 3:
            setError("Location lookup timed out. Start again to retry.");
            break;

          default:
            setError("Location tracking failed. Start again to retry.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }, [clearWatch]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && watchIdRef.current !== null) {
        stop();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      clearWatch();
    };
  }, [clearWatch, stop]);

  return {
    position,
    status,
    error,
    start,
    stop,
  };
}
