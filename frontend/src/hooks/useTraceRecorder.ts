import { useCallback, useEffect, useRef, useState } from 'react'

import type { LivePosition } from './useLiveLocation'
import type { LocationSample } from '../types/mapMatching'

const MAX_SAMPLES = 50

export function useTraceRecorder() {
  const recordingRef = useRef(false)
  const lastTimestampRef = useRef<number | null>(null)

  const [isRecording, setIsRecording] = useState(false)
  const [samples, setSamples] = useState<LocationSample[]>([])

  const startRecording = useCallback(() => {
    recordingRef.current = true
    lastTimestampRef.current = null

    setSamples([])
    setIsRecording(true)
  }, [])

  const stopRecording = useCallback(() => {
    recordingRef.current = false
    setIsRecording(false)
  }, [])

  const clearSamples = useCallback(() => {
    recordingRef.current = false
    lastTimestampRef.current = null

    setIsRecording(false)
    setSamples([])
  }, [])

  const recordReading = useCallback((reading: LivePosition) => {
    if (!recordingRef.current) {
      return
    }

    if (
      !Number.isFinite(reading.latitude) ||
      !Number.isFinite(reading.longitude) ||
      !Number.isFinite(reading.timestamp) ||
      !Number.isFinite(reading.accuracy) ||
      reading.latitude < -90 ||
      reading.latitude > 90 ||
      reading.longitude < -180 ||
      reading.longitude > 180 ||
      reading.accuracy < 0
    ) {
      return
    }

    const timestamp = new Date(reading.timestamp)

    if (!Number.isFinite(timestamp.getTime())) {
      return
    }

    if (
      lastTimestampRef.current !== null &&
      reading.timestamp <= lastTimestampRef.current
    ) {
      return
    }

    const sample: LocationSample = {
      latitude: reading.latitude,
      longitude: reading.longitude,
      timestamp: timestamp.toISOString(),
      accuracy: reading.accuracy,
      heading: reading.heading,
    }

    lastTimestampRef.current = reading.timestamp

    setSamples((currentSamples) =>
      [...currentSamples, sample].slice(-MAX_SAMPLES),
    )
  }, [])

  useEffect(() => {
    return () => {
      recordingRef.current = false
    }
  }, [])

  return {
    samples,
    isRecording,
    maxSamples: MAX_SAMPLES,
    startRecording,
    stopRecording,
    clearSamples,
    recordReading,
  }
}