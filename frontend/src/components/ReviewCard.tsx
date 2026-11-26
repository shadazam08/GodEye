import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import ReportPhotoGallery from './ReportPhotoGallery'
import type { ReviewDecision } from '../api/reviewer'
import type { ReportRead } from '../types/report'

interface ReviewCardProps {
  report: ReportRead
  disabled?: boolean
  onReview: (
    reportId: string,
    decision: ReviewDecision,
    reason: string,
  ) => Promise<void>
}

function ReviewCard({
  report,
  disabled = false,
  onReview,
}: ReviewCardProps) {
  const submittingRef = useRef(false)

  const [decision, setDecision] = useState<ReviewDecision | ''>('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (disabled || submittingRef.current) {
      return
    }

    setError('')

    if (!decision) {
      setError('Select a review decision.')
      return
    }

    const trimmedReason = reason.trim()

    if (trimmedReason.length < 10 || trimmedReason.length > 2000) {
      setError('The review reason must contain 10–2000 characters.')
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)

    try {
      await onReview(report.id, decision, trimmedReason)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not confirm the review. Refresh the queue.',
      )
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <article className="info-card admin-review-card">
      <ReportPhotoGallery
        reportId={report.id}
        isAdmin
      />
      <span className="feature-tag">{report.status}</span>

      <h3>{report.title}</h3>

      <p>{report.description}</p>
      <p>Location: {report.location_name}</p>
      <a
        className="button button-secondary"
        href={
          'https://www.openstreetmap.org/' +
          `?mlat=${report.latitude}&mlon=${report.longitude}` +
          `#map=18/${report.latitude}/${report.longitude}`
        }
        target="_blank"
        rel="noopener noreferrer"
      >
        View reported location ↗
      </a>
      <p>Reported severity: {report.severity}</p>
      <p>
        Submitted: {new Date(report.created_at).toLocaleString()}
      </p>

      <form
        className="review-decision-form"
        onSubmit={handleSubmit}
        aria-label={`Review: ${report.title}`}
        aria-busy={isSubmitting}
      >
        <fieldset
          disabled={disabled || isSubmitting}
          style={{
            minWidth: 0,
            margin: 0,
            padding: 0,
            border: 0,
          }}
        >
          <legend style={{ marginBottom: '16px', fontWeight: 700 }}>
            Review decision
          </legend>

          <div className="form-field">
            <label htmlFor={`decision-${report.id}`}>
              Decision
            </label>

            <select
              id={`decision-${report.id}`}
              value={decision}
              onChange={(event) => {
                const value = event.target.value

                if (
                  value === '' ||
                  value === 'verified' ||
                  value === 'rejected'
                ) {
                  setDecision(value)
                }
              }}
              required
            >
              <option value="" disabled>
                Select a decision
              </option>
              <option value="verified">
                Verify — publish as a mapped hazard
              </option>
              <option value="rejected">
                Reject — exclude from public hazards
              </option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor={`reason-${report.id}`}>
              Reason and supporting evidence
            </label>

            <textarea
              id={`reason-${report.id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this report should be verified or rejected."
              minLength={10}
              maxLength={2000}
              rows={4}
              required
            />
          </div>

          <button
            className="button button-primary"
            type="submit"
            disabled={disabled || isSubmitting}
          >
            {isSubmitting ? 'Saving decision…' : 'Save review decision'}
          </button>
        </fieldset>
      </form>

      {error && (
        <p className="form-message form-message-error" role="alert">
          {error}
        </p>
      )}
    </article>
  )
}

export default ReviewCard