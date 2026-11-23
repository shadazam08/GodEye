import { useEffect, useRef, useState } from 'react'

export interface DeviceLocation {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

interface CurrentLocationProps {
  onLocate: (location: DeviceLocation) => void
}

function CurrentLocation({ onLocate }: CurrentLocationProps) {
  const requestIdRef = useRef(0)
  const pendingRef = useRef(false)

  const [isLocating, setIsLocating] = useState(false)
  const [location, setLocation] = useState<DeviceLocation | null>(null)
  const [error, setError] = useState('')

  // Ignore callbacks after this component unmounts.
  useEffect(() => {
    return () => {
      requestIdRef.current += 1
      pendingRef.current = false
    }
  }, [])

  function handleLocate() {
    if (pendingRef.current) {
      return
    }

    setError('')

    if (!window.isSecureContext) {
      setError(
        'Location requires HTTPS or localhost. Open the site using a secure address.',
      )
      return
    }

    if (!navigator.geolocation) {
      setError('This browser does not support device location.')
      return
    }

    const requestId = ++requestIdRef.current

    pendingRef.current = true
    setIsLocating(true)
    setLocation(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId !== requestIdRef.current) {
          return
        }

        const reading: DeviceLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        }

        pendingRef.current = false
        setIsLocating(false)
        setLocation(reading)

        onLocate(reading)
      },
      (locationError) => {
        if (requestId !== requestIdRef.current) {
          return
        }

        pendingRef.current = false
        setIsLocating(false)

        switch (locationError.code) {
          case 1:
            setError(
              'Location permission was denied. You can still explore the map manually.',
            )
            break

          case 2:
            setError(
              'Your location is unavailable. Check device location settings and try again.',
            )
            break

          case 3:
            setError(
              'Location lookup timed out. Try again in a place with better reception.',
            )
            break

          default:
            setError('Could not read your location. Please try again.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    )
  }

  return (
    <div style={{ marginBlock: '20px' }}>
      <button
        className="button button-secondary"
        type="button"
        onClick={handleLocate}
        disabled={isLocating}
      >
        {isLocating ? 'Finding your location…' : 'Show my location'}
      </button>

      <p className="section-note">
        Requests one device location reading with your permission.
        This does not start continuous journey tracking.
      </p>

      {location && (
        <div className="section-note" role="status">
          <p>
            Location reading: {location.latitude.toFixed(6)},{' '}
            {location.longitude.toFixed(6)}
          </p>

          <p>
            Browser-reported horizontal accuracy radius:
            {' approximately '}
            {Math.ceil(location.accuracy)} metres.
          </p>

          <p>
            Reading time:{' '}
            {new Date(location.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}

      {error && (
        <p className="form-message form-message-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default CurrentLocation