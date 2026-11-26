import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import CameraCapture from './CameraCapture'
import { confirmAdminRepair } from '../api/admin'
import type { RepairConfirmation } from '../api/admin'

type Props = {
    reportId: string
    onConfirmed: (result: RepairConfirmation) => void
}

export default function RepairConfirmationForm({
    reportId,
    onConfirmed,
}: Props) {
    const mountedRef = useRef(false)
    const busyRef = useRef(false)
    const previewRef = useRef<string | null>(null)

    const [photo, setPhoto] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [note, setNote] = useState('')
    const [confirmed, setConfirmed] = useState(false)
    const [saving, setSaving] = useState(false)
    const [needsReload, setNeedsReload] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        mountedRef.current = true

        return () => {
            mountedRef.current = false

            if (previewRef.current) {
                URL.revokeObjectURL(previewRef.current)
            }
        }
    }, [])

    function clearPhoto() {
        if (previewRef.current) {
            URL.revokeObjectURL(previewRef.current)
            previewRef.current = null
        }

        setPhoto(null)
        setPreview(null)
    }

    function selectPhoto(file: File) {
        if (busyRef.current || needsReload) return

        clearPhoto()

        const address = URL.createObjectURL(file)

        previewRef.current = address
        setPhoto(file)
        setPreview(address)
        setError('')
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (busyRef.current || needsReload) return

        if (!photo || !confirmed) {
            setError('Take a repair photo and confirm the inspection.')
            return
        }

        const cleanNote = note.trim()

        if (cleanNote.length < 10 || cleanNote.length > 2000) {
            setError('Explain the repair in 10–2000 characters.')
            return
        }

        busyRef.current = true
        setSaving(true)
        setError('')

        try {
            const result = await confirmAdminRepair(
                reportId,
                cleanNote,
                photo,
            )

            if (!mountedRef.current) return

            if (result.report_id !== reportId) {
                throw new Error('The repair confirmation could not be verified.')
            }

            clearPhoto()
            onConfirmed(result)
        } catch (caught) {
            if (mountedRef.current) {
                setError(
                    caught instanceof Error
                        ? caught.message
                        : 'Repair confirmation could not be confirmed.',
                )

                // Avoid duplicate submissions after an uncertain request.
                setNeedsReload(true)
            }
        } finally {
            busyRef.current = false

            if (mountedRef.current) {
                setSaving(false)
            }
        }
    }

    return (
        <details className="repair-confirmation-panel">
            <summary>Confirm road repair</summary>

            <p className="section-note">
                Confirm only after checking that the reported damage
                has been repaired. A repair photo and note are required.
            </p>

            <form onSubmit={submit} aria-busy={saving}>
                <fieldset disabled={saving || needsReload}>
                    <legend>Repair evidence</legend>

                    {!photo && (
                        <CameraCapture onCapture={selectPhoto} />
                    )}

                    {preview && (
                        <div>
                            <img
                                className="report-photo-image"
                                src={preview}
                                alt="Repair photo awaiting submission"
                            />

                            <button
                                className="button button-secondary"
                                type="button"
                                onClick={clearPhoto}
                            >
                                Retake photo
                            </button>
                        </div>
                    )}

                    <label className="form-field">
                        <span>Repair note</span>

                        <textarea
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            minLength={10}
                            maxLength={2000}
                            rows={3}
                            placeholder="Describe what was repaired and how you checked it."
                            required
                        />
                    </label>

                    <label className="repair-inspection-check">
                        <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(event) => setConfirmed(event.target.checked)}
                            required
                        />

                        <span>
                            I have checked the repair evidence and confirm
                            that this reported damage has been repaired.
                        </span>
                    </label>

                    <button
                        className="button button-primary"
                        type="submit"
                        disabled={!photo || !confirmed || saving}
                    >
                        {saving ? 'Saving repair…' : 'Confirm repair'}
                    </button>
                </fieldset>
            </form>

            {error && (
                <p className="form-message form-message-error" role="alert">
                    {error}
                </p>
            )}

            {needsReload && (
                <p role="status">
                    Use the dashboard’s Reload list button before trying again.
                    Check whether the repair was already saved.
                </p>
            )}
        </details>
    )
}