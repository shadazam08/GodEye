import { useEffect, useRef, useState } from 'react'
import { Camera, CameraDirection, EncodingType } from '@capacitor/camera'

type Props = {
    onCapture: (file: File) => void
}

const MAX_PHOTO_BYTES = 3 * 1024 * 1024

function errorCode(error: unknown): string {
    if (typeof error !== 'object' || error === null) return ''

    const code = (error as Record<string, unknown>).code
    return typeof code === 'string' ? code : ''
}

export default function NativeCameraCapture({ onCapture }: Props) {
    const stateRef = useRef({
        mounted: false,
        request: null as AbortController | null,
    })

    const [phase, setPhase] = useState<
        'idle' | 'opening' | 'preparing'
    >('idle')

    const [error, setError] = useState('')

    useEffect(() => {
        const state = stateRef.current
        state.mounted = true

        return () => {
            state.mounted = false
            state.request?.abort()
            state.request = null
        }
    }, [])

    async function openCamera() {
        const state = stateRef.current

        if (!state.mounted || state.request) return

        const controller = new AbortController()
        state.request = controller

        let preparing = false

        function isCurrent() {
            return state.mounted && state.request === controller
        }

        setError('')
        setPhase('opening')

        try {
            const photo = await Camera.takePhoto({
                quality: 85,
                targetWidth: 1600,
                targetHeight: 1600,
                encodingType: EncodingType.JPEG,
                cameraDirection: CameraDirection.Rear,
                correctOrientation: true,
                editable: 'no',
                saveToGallery: false,
                includeMetadata: false,
            })

            // Android's camera temporarily hides the app.
            // Accept the result if this component is still mounted.
            if (!isCurrent()) return

            preparing = true
            setPhase('preparing')

            if (!photo.webPath) {
                throw new Error('The captured photo is unavailable.')
            }

            const timeout = window.setTimeout(
                () => controller.abort(),
                20_000,
            )

            try {
                const response = await fetch(photo.webPath, {
                    signal: controller.signal,
                    cache: 'no-store',
                })

                if (!response.ok) {
                    throw new Error(
                        'The captured photo could not be read.',
                    )
                }

                const blob = await response.blob()

                if (!isCurrent()) return

                if (controller.signal.aborted) {
                    throw new Error('Photo preparation timed out.')
                }

                if (blob.size === 0) {
                    setError(
                        'The photo is empty. Please take another photo.',
                    )
                    return
                }

                if (blob.size > MAX_PHOTO_BYTES) {
                    setError(
                        'The photo is larger than 3 MiB. Please take another photo.',
                    )
                    return
                }

                onCapture(
                    new File([blob], 'road-damage.jpg', {
                        type: 'image/jpeg',
                    }),
                )
            } finally {
                window.clearTimeout(timeout)
            }
        } catch (cause) {
            if (!isCurrent()) return

            const code = errorCode(cause)

            // Closing the camera without taking a photo is normal.
            if (code === 'OS-PLUG-CAMR-0006') return

            if (code === 'OS-PLUG-CAMR-0003') {
                setError(
                    'Camera access was denied. Check camera permissions in your phone settings and try again.',
                )
            } else if (code === 'OS-PLUG-CAMR-0007') {
                setError(
                    'No camera app is available on this phone.',
                )
            } else {
                setError(
                    preparing
                        ? 'Could not prepare the photo. Please take another photo.'
                        : 'Could not open the phone camera. Please try again.',
                )
            }
        } finally {
            if (isCurrent()) {
                state.request = null
                setPhase('idle')
            }
        }
    }

    return (
        <div>
            <button
                className="button button-primary"
                type="button"
                disabled={phase !== 'idle'}
                onClick={() => void openCamera()}
            >
                {phase === 'opening'
                    ? 'Opening camera…'
                    : phase === 'preparing'
                        ? 'Preparing photo…'
                        : '📷 Open camera'}
            </button>

            {error && (
                <p
                    className="form-message form-message-error"
                    role="alert"
                >
                    {error}
                </p>
            )}
        </div>
    )
}