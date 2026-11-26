import { useEffect, useRef, useState } from 'react'
import {
    getReportPhotos,
    getReportPhotoPreview,
} from '../api/photos'
import type { ReportPhoto } from '../types/photos'
import {
    getAdminPhotos,
    getAdminPhotoPreview,
} from '../api/admin'

function PhotoImage({
    reportId,
    photo,
    isAdmin,
}: {
    reportId: string
    photo: ReportPhoto
    isAdmin?: boolean
}) {
    const dialogRef = useRef<HTMLDialogElement>(null)

    const [url, setUrl] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let active = true

        async function loadPreview() {
            try {
                const preview = isAdmin
                    ? await getAdminPhotoPreview(reportId, photo.id)
                    : await getReportPhotoPreview(reportId, photo.id)

                if (!active) return

                const address = new URL(preview.url)

                if (
                    preview.photo_id !== photo.id ||
                    address.protocol !== 'https:'
                ) {
                    throw new Error('Invalid photo preview.')
                }

                setUrl(address.href)
            } catch {
                if (active) {
                    setError('Photo could not be loaded.')
                }
            } finally {
                if (active) {
                    setLoading(false)
                }
            }
        }

        void loadPreview()

        return () => {
            active = false
        }
    }, [reportId, photo.id, isAdmin, attempt])

    function retry() {
        setUrl('')
        setError('')
        setLoading(true)
        setAttempt((value) => value + 1)
    }

    if (loading) {
        return (
            <div className="report-photo-placeholder" role="status">
                Loading photo…
            </div>
        )
    }

    if (error || !url) {
        return (
            <div className="report-photo-placeholder">
                <p>{error || 'Photo unavailable.'}</p>

                <button
                    className="button button-secondary"
                    type="button"
                    onClick={retry}
                >
                    Reload photo
                </button>
            </div>
        )
    }

    return (
        <>
            <button
                className="report-photo-open"
                type="button"
                aria-label="Open road damage photo in full view"
                onClick={() => dialogRef.current?.showModal()}
            >
                <img
                    src={url}
                    alt="Submitted road damage"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setError('Photo could not be loaded.')}
                />

                <span>Tap to enlarge</span>
            </button>

            <dialog
                ref={dialogRef}
                className="report-photo-dialog"
                aria-label="Road damage photo"
            >
                <button
                    className="button button-secondary"
                    type="button"
                    autoFocus
                    onClick={() => dialogRef.current?.close()}
                >
                    Close photo
                </button>

                <img
                    src={url}
                    alt="Full view of submitted road damage"
                    referrerPolicy="no-referrer"
                    onError={() => {
                        dialogRef.current?.close()
                        setError('Photo preview expired or could not load.')
                    }}
                />
            </dialog>
        </>
    )
}

export default function ReportPhotoGallery({
    reportId,
    isAdmin,
}: {
    reportId: string
    isAdmin?: boolean
}) {
    const [photos, setPhotos] = useState<ReportPhoto[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let active = true

        async function loadPhotos() {
            try {
                const result = isAdmin
                    ? await getAdminPhotos(reportId)
                    : await getReportPhotos(reportId)

                if (!active) return

                if (result.some((photo) => photo.report_id !== reportId)) {
                    throw new Error('Invalid photo list.')
                }

                setPhotos(result)
            } catch {
                if (active) {
                    setError('Photos could not be loaded.')
                }
            } finally {
                if (active) {
                    setLoading(false)
                }
            }
        }

        void loadPhotos()

        return () => {
            active = false
        }
    }, [reportId, isAdmin, attempt])

    if (loading) {
        return (
            <div className="report-photo-placeholder" role="status">
                Loading photos…
            </div>
        )
    }

    if (error) {
        return (
            <div className="report-photo-placeholder">
                <p>{error}</p>

                <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => {
                        setLoading(true)
                        setError('')
                        setAttempt((value) => value + 1)
                    }}
                >
                    Reload photos
                </button>
            </div>
        )
    }

    if (photos.length === 0) {
        return (
            <div className="report-photo-placeholder">
                No photo attached to this older report.
            </div>
        )
    }

    return (
        <div className="report-card-photos">
            {photos.map((photo) => (
                <PhotoImage
                    key={photo.id}
                    reportId={reportId}
                    photo={photo}
                    isAdmin={isAdmin}
                />
            ))}
        </div>
    )
}