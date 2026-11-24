import { useEffect, useRef, useState } from 'react'

import { getMyReports } from '../api/account'
import { useAuth } from '../hooks/useAuth'
import type { ReportRead, ReportStatus } from '../types/report'

const statusLabels: Record<ReportStatus, string> = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
}

function UserReportList() {
  const mountedRef = useRef(true)
  const busyRef = useRef(false)

  const [reports, setReports] = useState<ReportRead[]>([])
  const [offset, setOffset] = useState(0)
  const [hasNextBatch, setHasNextBatch] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  async function loadReports(nextOffset = 0) {
    if (busyRef.current) {
      return
    }

    busyRef.current = true
    setIsLoading(true)
    setError('')

    try {
      const data = await getMyReports(nextOffset)

      if (!mountedRef.current) {
        return
      }

      setReports(data)
      setOffset(nextOffset)
      setHasNextBatch(data.length === 20)
      setHasLoaded(true)
    } catch (caughtError) {
      if (mountedRef.current) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Loading..',
        )
      }
    } finally {
      busyRef.current = false

      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }

  return (
    <>
      <div className="reviewer-toolbar">
        <button
          className="button button-primary"
          type="button"
          onClick={() => void loadReports(0)}
          disabled={isLoading}
        >
          {isLoading
            ? 'Loading Reports..'
            : 'Refresh'}
        </button>
      </div>

      {error && (
        <p className="form-message form-message-error" role="alert">
          {error}
          {hasLoaded && ' The previously loaded list is showing below.'}
        </p>
      )}

      {hasLoaded && !isLoading && !error && (
        <p className="section-note" role="status">
          {reports.length === 0
            ? 'Not Found'
            : `${reports.length} reports`}
        </p>
      )}

      <div className="reviewer-list" aria-busy={isLoading}>
        {reports.map((report) => (
          <article className="info-card" key={report.id}>
            <span className="feature-tag">
              {statusLabels[report.status]}
            </span>

            <h3>{report.title}</h3>
            <p>{report.description}</p>
            <p>Jagah: {report.location_name}</p>
            <p>Reported severity: {report.severity}</p>
            <p>
              Bheji gayi:{' '}
              {new Date(report.created_at).toLocaleString()}
            </p>
            <p className="reviewer-reference">
              Reference: {report.id}
            </p>
          </article>
        ))}
      </div>

      {hasLoaded && (
        <div className="reviewer-toolbar">
          <button
            className="button button-secondary"
            type="button"
            disabled={isLoading || offset === 0}
            onClick={() =>
              void loadReports(Math.max(0, offset - 20))
            }
          >
            Prev
          </button>

          <button
            className="button button-secondary"
            type="button"
            disabled={isLoading || !hasNextBatch}
            onClick={() => void loadReports(offset + 20)}
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
      id="my-reports"
      aria-labelledby="my-reports-title"
    >
      <span className="eyebrow">YOUR REPORTS AND STATUS</span>

      <h2 className="section-title" id="my-reports-title">
        My Reports
      </h2>

      {loading ? (
        <p className="section-note" role="status">
          Check Login...
        </p>
      ) : user ? (
        <UserReportList key={user.uid} />
      ) : (
        <p className="section-note">
          First Loing
        </p>
      )}
    </section>
  )
}

export default MyReports