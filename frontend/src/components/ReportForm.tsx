import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { API_BASE_URL } from '../config'
import LocationPicker from './LocationPicker'

import type { ReportCreate, ReportRead } from '../types/report'

function ReportForm() {
    const submittingRef = useRef(false)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [savedReport, setSavedReport] = useState<ReportRead | null>(null)

    const [latitude, setLatitude] = useState('')
    const [longitude, setLongitude] = useState('')

    const parsedLatitude =
        latitude.trim() === '' ? Number.NaN : Number(latitude)

    const parsedLongitude =
        longitude.trim() === '' ? Number.NaN : Number(longitude)

    const selectedLocation = Number.isFinite(parsedLatitude) &&
        Number.isFinite(parsedLongitude) &&
        parsedLatitude >= -90 &&
        parsedLatitude <= 90 &&
        parsedLongitude >= -180 &&
        parsedLongitude <= 180
        ? {
            latitude: parsedLatitude,
            longitude: parsedLongitude,
        }
        : null

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        // Prevent another submission while this request is running.
        if (submittingRef.current) {
            return
        }

        const form = event.currentTarget
        const formData = new FormData(form)

        setError('')
        setSavedReport(null)

        const severity = formData.get('severity')

        if (
            severity !== 'low' &&
            severity !== 'medium' &&
            severity !== 'high'
        ) {
            setError('Please select a valid severity.')
            return
        }

        const latitudeText = String(formData.get('latitude') ?? '').trim()
        const longitudeText = String(formData.get('longitude') ?? '').trim()

        if (!latitudeText || !longitudeText) {
            setError('Please enter both latitude and longitude.')
            return
        }

        const payload: ReportCreate = {
            title: String(formData.get('title') ?? '').trim(),
            description: String(formData.get('description') ?? '').trim(),
            location_name: String(formData.get('location_name') ?? '').trim(),
            latitude: Number(latitudeText),
            longitude: Number(longitudeText),
            severity,
        }

        if (
            payload.title.length < 5 ||
            payload.description.length < 10 ||
            payload.location_name.length < 3
        ) {
            setError(
                'Please enter a title of at least 5 characters, a description ' +
                'of at least 10 characters, and a location name of at least 3 characters.',
            )
            return
        }

        if (
            !Number.isFinite(payload.latitude) ||
            !Number.isFinite(payload.longitude) ||
            payload.latitude < -90 ||
            payload.latitude > 90 ||
            payload.longitude < -180 ||
            payload.longitude > 180
        ) {
            setError('Please enter valid latitude and longitude values.')
            return
        }

        submittingRef.current = true
        setIsSubmitting(true)

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/reports`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                },
            )

            if (!response.ok) {
                if (response.status === 422) {
                    setError(
                        'Some report details are invalid. Check the fields and try again.',
                    )
                } else {
                    setError(
                        'The server could not save your report. Please try again later.',
                    )
                }

                return
            }

            const report: ReportRead = await response.json()

            setSavedReport(report)
            form.reset()
            setLatitude('')
            setLongitude('')
        } catch {
            setError(
                'Could not confirm submission. Your report may have reached ' +
                'the server. Check your connection before submitting again.',
            )
        } finally {
            submittingRef.current = false
            setIsSubmitting(false)
        }
    }

    return (
        <section
            className="section-container content-section"
            id="report-pothole"
            aria-labelledby="report-form-title"
        >
            <span className="eyebrow">HELP KEEP ROAD INFORMATION CURRENT</span>

            <h2 className="section-title" id="report-form-title">
                Report a pothole
            </h2>

            <p className="section-note" id="report-guidance">
                Submit only while stationary or as a passenger. Your report
                will remain pending until reviewed. Do not include personal
                information in the description.
            </p>

            <form
                className="report-form"
                onSubmit={handleSubmit}
                aria-describedby="report-guidance"
                aria-busy={isSubmitting}
            >
                <fieldset disabled={isSubmitting}>
                    <legend>Pothole details</legend>

                    <div className="form-field">
                        <label htmlFor="report-title">Report title</label>
                        <input
                            id="report-title"
                            name="title"
                            type="text"
                            placeholder="Example: Road damage near the bus stop"
                            minLength={5}
                            maxLength={120}
                            required
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="report-location">Road or nearby landmark</label>
                        <input
                            id="report-location"
                            name="location_name"
                            type="text"
                            placeholder="Enter the road name or landmark"
                            minLength={3}
                            maxLength={200}
                            required
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="report-description">Description</label>
                        <textarea
                            id="report-description"
                            name="description"
                            placeholder="Describe the damage and where it is on the road."
                            minLength={10}
                            maxLength={2000}
                            rows={4}
                            required
                        />
                    </div>

                    <LocationPicker
                        value={selectedLocation}
                        onSelect={(location) => {
                            setLatitude(String(location.latitude))
                            setLongitude(String(location.longitude))
                        }}
                        disabled={isSubmitting}
                    />
                    <div className="form-row">
                        <div className="form-field">
                            <label htmlFor="report-latitude">Latitude</label>
                            <input
                                id="report-latitude"
                                name="latitude"
                                type="number"
                                min={-90}
                                max={90}
                                step="any"
                                placeholder="Select on map or enter latitude"
                                value={latitude}
                                onChange={(event) => setLatitude(event.target.value)}
                                required
                            />
                        </div>

                        <div className="form-field">
                            <label htmlFor="report-longitude">Longitude</label>
                            <input
                                id="report-longitude"
                                name="longitude"
                                type="number"
                                min={-180}
                                max={180}
                                step="any"
                                placeholder="Select on map or enter longitude"
                                value={longitude}
                                onChange={(event) => setLongitude(event.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-field">
                        <label htmlFor="report-severity">Estimated severity</label>
                        <select
                            id="report-severity"
                            name="severity"
                            defaultValue=""
                            required
                        >
                            <option value="" disabled>
                                Select severity
                            </option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>

                    <button
                        className="button button-primary"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Submitting…' : 'Submit report'}
                    </button>
                </fieldset>
            </form>

            {error && (
                <p className="form-message form-message-error" role="alert">
                    {error}
                </p>
            )}

            {savedReport && (
                <div
                    className="form-message form-message-success"
                    role="status"
                >
                    <h3>Report submitted</h3>
                    <p>{savedReport.title}</p>
                    <p>Reference: {savedReport.id}</p>
                    <p>Status: {savedReport.status}. Awaiting review.</p>
                </div>
            )}
        </section>
    )
}

export default ReportForm