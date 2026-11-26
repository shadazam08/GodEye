import { useEffect, useState } from 'react'

import { getAdminReviewHistory } from '../api/admin'
import type { AdminReviewEvent } from '../api/admin'
import type { ReportRead } from '../types/report'
import RepairConfirmationForm from './RepairConfirmationForm'
import ReportPhotoGallery from './ReportPhotoGallery'

export default function ReviewedReportCard({
  report,
}: {
  report: ReportRead
}) {
  const [events, setEvents] = useState<AdminReviewEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null)

  const repairedAt = report.repaired_at ?? confirmedAt

  useEffect(() => {
    let active = true

    async function loadHistory() {
      try {
        const result = await getAdminReviewHistory(report.id)

        if (!active) return

        if (result.some((event) => event.report_id !== report.id)) {
          throw new Error('Unexpected history response.')
        }

        setEvents(result)
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Could not load review history.',
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadHistory()

    return () => {
      active = false
    }
  }, [report.id, attempt])

  return (
    <article className="my-report-card">
      <ReportPhotoGallery
        key={repairedAt ?? 'unrepaired'}
        reportId={report.id}
        isAdmin
      />

      <div className="my-report-content">
        <span
          className={`report-status report-status-${report.status}`}
        >
          {repairedAt
            ? 'Repair confirmed'
            : report.status === 'verified'
              ? 'Verified — repair pending'
              : 'Rejected'}
        </span>

        <h2 className="my-report-location">
          📍 {report.location_name}
        </h2>

        <p className="my-report-title">{report.title}</p>

        <div className="my-report-meta">
          <span>Reported severity: {report.severity}</span>

          <span>
            Submitted:{' '}
            {new Date(report.created_at).toLocaleDateString('en-IN')}
          </span>
        </div>

        {report.status === 'verified' && (
          repairedAt ? (
            <p className="my-report-update" role="status">
              Repair confirmed on{' '}
              {new Date(repairedAt).toLocaleString('en-IN')}.
              This report is excluded from active hazards.
            </p>
          ) : (
            <RepairConfirmationForm
              reportId={report.id}
              onConfirmed={(result) => {
                setConfirmedAt(result.created_at)
              }}
            />
          )
        )}

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
          View location ↗
        </a>

        <section aria-label="Review history">
          <h3>Review history</h3>

          {loading && (
            <p role="status">Loading decision history…</p>
          )}

          {error && (
            <div>
              <p className="form-message form-message-error" role="alert">
                {error}
              </p>

              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setLoading(true)
                  setError('')
                  setAttempt((value) => value + 1)
                }}
              >
                Reload history
              </button>
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <p>No review history is available for this report.</p>
          )}

          {!loading && !error && (
            <ol className="admin-history-list">
              {events.map((event) => (
                <li key={event.id}>
                  <strong>
                    {event.new_status === 'verified'
                      ? 'Approved'
                      : 'Rejected'}
                  </strong>

                  <p>Reviewed by: {event.reviewer_label}</p>

                  <p>
                    <time dateTime={event.created_at}>
                      {new Date(event.created_at).toLocaleString('en-IN')}
                    </time>
                  </p>

                  <p className="admin-history-reason">
                    {event.reason}
                  </p>

                  {!event.reviewer_uid && (
                    <p className="section-note">
                      This older decision has no linked admin account.
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <details className="my-report-details">
          <summary>Original report details</summary>
          <p>{report.description}</p>
        </details>
      </div>
    </article>
  )
}