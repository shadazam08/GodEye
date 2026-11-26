import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { getMyReports } from '../api/account'
import { useAuth } from '../hooks/useAuth'
import type { ReportRead, ReportStatus } from '../types/report'
import ReportPhotoGallery from './ReportPhotoGallery'


const statusLabels: Record<ReportStatus, string> = {
  pending: 'Waiting for review',
  verified: 'Verified report',
  rejected: 'Not accepted',
}

function UserReportList() {
  const [reports, setReports] = useState<ReportRead[]>([])
  const [offset, setOffset] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  const [hasNextBatch, setHasNextBatch] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadReports() {
      try {
        const data = await getMyReports(offset)

        if (!active) return

        setReports(data)
        setHasNextBatch(data.length === 20)
        setError('')
      } catch (caught) {
        if (!active) return

        setError(
          caught instanceof Error
            ? caught.message
            : 'Could not load your reports.',
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadReports()

    return () => {
      active = false
    }
  }, [offset, retryCount])

  function changePage(nextOffset: number) {
    setLoading(true)
    setError('')
    setOffset(nextOffset)
  }

  function retry() {
    setLoading(true)
    setError('')
    setRetryCount((value) => value + 1)
  }

  if (loading) {
    return (
      <p className="section-note" role="status">
        Loading your reports…
      </p>
    )
  }

  if (error) {
    return (
      <div>
        <p className="form-message form-message-error" role="alert">
          {error}
        </p>

        <button
          className="button button-secondary"
          type="button"
          onClick={retry}
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <>
      {reports.length === 0 ? (
        <div className="info-card">
          <h3>
            {offset === 0
              ? 'You have not submitted any reports yet.'
              : 'No more reports on this page.'}
          </h3>

          {offset === 0 && (
            <Link className="button button-primary" to="/report">
              Report road damage
            </Link>
          )}
        </div>
      ) : (
        <div className="reviewer-list">
          {reports.map((report) => (
            <article className="my-report-card" key={report.id}>
              <ReportPhotoGallery reportId={report.id} />

              <div className="my-report-content">
                <span
                  className={`report-status report-status-${report.status}`}
                >
                  {report.repaired_at
                    ? 'Repair confirmed'
                    : statusLabels[report.status]}
                </span>

                <h2 className="my-report-location">
                  <span aria-hidden="true">📍 </span>
                  {report.location_name}
                </h2>

                <p className="my-report-title">{report.title}</p>

                <div className="my-report-meta">
                  <span>
                    Reported severity:{' '}
                    {{
                      low: 'Low',
                      medium: 'Medium',
                      high: 'High',
                    }[report.severity]}
                  </span>

                  <time dateTime={report.created_at}>
                    {new Date(report.created_at).toLocaleDateString(
                      'en-IN',
                      {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      },
                    )}
                  </time>
                </div>

                {report.status === 'pending' && (
                  <p className="my-report-update">
                    Your report is waiting for review.
                  </p>
                )}

                {report.status === 'verified' && !report.repaired_at && (
                  <p className="my-report-update">
                    Repair confirmed on{' '}
                    {report.repaired_at
                      ? new Date(report.repaired_at).toLocaleDateString('en-IN')
                      : 'Date unavailable '}.
                    {' '}Your report is retained in your history.
                  </p>
                )}

                {report.status === 'rejected' && (
                  <p className="my-report-update">
                    This report was not accepted during review.
                  </p>
                )}

                <a
                  className="button button-primary"
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

                <details className="my-report-details">
                  <summary>Report details</summary>
                  <p>{report.description}</p>
                </details>
              </div>
            </article>
          ))}
        </div>
      )}

      {(offset > 0 || hasNextBatch) && (
        <div className="reviewer-toolbar">
          <button
            className="button button-secondary"
            type="button"
            disabled={offset === 0}
            onClick={() => changePage(Math.max(0, offset - 20))}
          >
            Previous
          </button>

          <button
            className="button button-secondary"
            type="button"
            disabled={!hasNextBatch}
            onClick={() => changePage(offset + 20)}
          >
            Next
          </button>
        </div>
      )}
    </>
  )
}

function MyReports() {
  const { user, loading } = useAuth()

  return (
    <section
      className="section-container content-section"
      aria-labelledby="my-reports-title"
    >
      <h1 className="section-title" id="my-reports-title">
        My Reports
      </h1>

      {loading ? (
        <p className="section-note" role="status">
          Checking login…
        </p>
      ) : user ? (
        <UserReportList key={user.uid} />
      ) : (
        <p className="section-note">
          Please use the Login button above to view your reports.
        </p>
      )}
    </section>
  )
}

export default MyReports