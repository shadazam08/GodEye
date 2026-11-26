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

  // A manual stop prevents automatic resume in this mounted session.
  const locationEnabledRef = useRef(true);

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
    locationEnabledRef.current = false;

    clearWatch();
    onSessionResetRef.current?.();

    setPosition(null);
    setStatus("stopped");
    setError("");
  }, [clearWatch]);

  const start = useCallback(() => {
    locationEnabledRef.current = true;

    clearWatch();
    onSessionResetRef.current?.();

    setPosition(null);
    setError("");

    if (!window.isSecureContext || !navigator.geolocation) {
      locationEnabledRef.current = false;
      setStatus("error");
      setError("Location requires a supported browser and HTTPS or localhost.");
      return;
    }

    if (document.hidden) {
      setStatus("stopped");
      return;
    }

    const session = sessionRef.current;

    setStatus("requesting");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (reading) => {
        if (session !== sessionRef.current || document.hidden) {
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
        setError("");

        onReadingRef.current?.(nextPosition);
      },
      (locationError) => {
        if (session !== sessionRef.current) {
          return;
        }

        setPosition(null);
        setStatus("error");

        if (locationError.code === 1) {
          // Do not repeatedly request a denied permission.
          locationEnabledRef.current = false;
          clearWatch();
          onSessionResetRef.current?.();

          setError("Location is blocked. Allow location in your browser's " + "site settings, then select Try again.");
          return;
        }

        // Keep the watch registered for temporary GPS failures.
        setError(
          locationError.code === 3
            ? "Waiting for GPS. Check that device location is enabled."
            : "Location is temporarily unavailable. Waiting for an update.",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }, [clearWatch]);

  useEffect(() => {
    // Start automatically after the map screen mounts.
    const startupTimer = window.setTimeout(() => {
      if (locationEnabledRef.current && !document.hidden) {
        start();
      }
    }, 0);

    function handleVisibilityChange() {
      if (document.hidden) {
        clearWatch();
        onSessionResetRef.current?.();

        setPosition(null);
        setStatus("stopped");
        setError("");
        return;
      }

      if (locationEnabledRef.current) {
        start();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(startupTimer);

      document.removeEventListener("visibilitychange", handleVisibilityChange);

      clearWatch();
    };
  }, [clearWatch, start]);

  return {
    position,
    status,
    error,
    start,
    stop,
  };
}
