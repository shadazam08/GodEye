import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import NativeCameraCapture from './NativeCameraCapture'

type Props = {
    onCapture: (file: File) => void
}

function BrowserCameraCapture({ onCapture }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const mountedRef = useRef(false)
    const requestRef = useRef(0)
    const busyRef = useRef(false)

    const [opening, setOpening] = useState(false)
    const [active, setActive] = useState(false)
    const [ready, setReady] = useState(false)
    const [capturing, setCapturing] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        mountedRef.current = true

        function stopStream() {
            requestRef.current += 1
            streamRef.current?.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }

        function handleVisibility() {
            if (document.hidden) {
                stopStream()
                busyRef.current = false
                setOpening(false)
                setCapturing(false)
                setActive(false)
                setReady(false)
            }
        }

        document.addEventListener('visibilitychange', handleVisibility)

        return () => {
            mountedRef.current = false
            stopStream()
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [])

    function closeCamera() {
        requestRef.current += 1
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null

        if (videoRef.current) {
            videoRef.current.srcObject = null
        }

        busyRef.current = false
        setOpening(false)
        setCapturing(false)
        setActive(false)
        setReady(false)
    }

    async function openCamera() {
        if (busyRef.current || streamRef.current) return

        if (!navigator.mediaDevices?.getUserMedia) {
            setError('Camera access requires HTTPS or localhost and a supported browser.')
            return
        }

        busyRef.current = true
        const requestId = ++requestRef.current

        setError('')
        setOpening(true)
        setReady(false)

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1600 },
                    height: { ideal: 1200 },
                },
            })

            if (
                !mountedRef.current ||
                requestRef.current !== requestId ||
                document.hidden
            ) {
                stream.getTracks().forEach((track) => track.stop())
                return
            }

            streamRef.current = stream

            const video = videoRef.current

            if (!video) {
                throw new Error('Camera preview is unavailable.')
            }

            video.srcObject = stream
            setActive(true)
            await video.play()
        } catch {
            if (mountedRef.current && requestRef.current === requestId) {
                closeCamera()
                setError(
                    'Could not open the camera. Allow camera permission, ' +
                    'check that a camera is connected and try again.',
                )
            }
        } finally {
            if (mountedRef.current && requestRef.current === requestId) {
                busyRef.current = false
                setOpening(false)
            }
        }
    }

    function takePhoto() {
        const video = videoRef.current

        if (
            busyRef.current ||
            !video ||
            !streamRef.current ||
            !video.videoWidth ||
            !video.videoHeight
        ) {
            return
        }

        const canvas = document.createElement('canvas')
        const scale = Math.min(
            1,
            1600 / Math.max(video.videoWidth, video.videoHeight),
        )

        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)

        const context = canvas.getContext('2d')

        if (!context) {
            setError('Could not capture the photo. Please try again.')
            return
        }

        busyRef.current = true
        setCapturing(true)
        setError('')

        const requestId = requestRef.current

        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        canvas.toBlob(
            (blob) => {
                if (
                    !mountedRef.current ||
                    requestRef.current !== requestId
                ) {
                    return
                }

                busyRef.current = false
                setCapturing(false)

                if (!blob || blob.size > 3 * 1024 * 1024) {
                    setError('Could not prepare the photo. Please take another photo.')
                    return
                }

                const file = new File([blob], 'road-damage.jpg', {
                    type: 'image/jpeg',
                })

                closeCamera()
                onCapture(file)
            },
            'image/jpeg',
            0.85,
        )
    }

    return (
        <div>
            {!active && (
                <button
                    className="button button-primary"
                    type="button"
                    disabled={opening}
                    onClick={() => void openCamera()}
                >
                    {opening ? 'Opening camera…' : '📷 Open camera'}
                </button>
            )}

            <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                hidden={!active}
                aria-label="Live camera preview"
                onCanPlay={() => setReady(true)}
                style={{
                    width: '100%',
                    maxHeight: '360px',
                    borderRadius: '12px',
                    background: '#000',
                    marginTop: '12px',
                }}
            />

            {active && (
                <div className="report-photo-actions">
                    <button
                        className="button button-primary"
                        type="button"
                        disabled={!ready || opening || capturing}
                        onClick={takePhoto}
                    >
                        {capturing ? 'Preparing photo…' : 'Take photo'}
                    </button>

                    <button
                        className="button button-secondary"
                        type="button"
                        onClick={closeCamera}
                    >
                        Cancel
                    </button>
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

export default function CameraCapture({ onCapture }: Props) {
    return Capacitor.isNativePlatform()
        ? <NativeCameraCapture onCapture={onCapture} />
        : <BrowserCameraCapture onCapture={onCapture} />
}