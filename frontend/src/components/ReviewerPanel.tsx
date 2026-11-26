import { useEffect, useRef, useState } from 'react'

import { getAdminReports, saveAdminReview } from '../api/admin'
import type { ReviewDecision } from '../api/reviewer'
import type { ReportRead, ReportStatus } from '../types/report'
import { useAuth } from '../hooks/useAuth'

import AuthControls from './AuthControls'
import ReviewCard from './ReviewCard'
import ReviewedReportCard from './ReviewedReportCard'

const views: { value: ReportStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function ReportQueue({
  reviewStatus,
  mine,
}: {
  reviewStatus: ReportStatus
  mine: boolean
}) {
  const mountedRef = useRef(false)
  const busyRef = useRef(false)

  const [reports, setReports] = useState<ReportRead[]>([])
  const [offset, setOffset] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [hasNext, setHasNext] = useState(false)

  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [needsReload, setNeedsReload] = useState(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadReports() {
      try {
        const result = await getAdminReports(
          offset,
          reviewStatus,
          mine,
        )

        if (!active) return

        setReports(result)
        setHasNext(result.length === 50)
        setNeedsReload(false)
        setError('')
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Could not load reports.',
          )
        }
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
  }, [offset, attempt, reviewStatus, mine])

  function reload() {
    if (busyRef.current) return

    setLoading(true)
    setError('')
    setNotice('')
    setAttempt((value) => value + 1)
  }

  function changePage(nextOffset: number) {
    if (busyRef.current) return

    setLoading(true)
    setError('')
    setNotice('')
    setOffset(nextOffset)
  }

  async function handleReview(
    reportId: string,
    decision: ReviewDecision,
    reason: string,
  ): Promise<void> {
    if (
      reviewStatus !== 'pending' ||
      busyRef.current ||
      loading ||
      needsReload
    ) {
      throw new Error('Reload the queue before making another decision.')
    }

    busyRef.current = true
    setReviewing(true)
    setNotice('')

    try {
      const updated = await saveAdminReview(
        reportId,
        decision,
        reason,
      )

      if (!mountedRef.current) return

      setReports((current) =>
        current.filter((report) => report.id !== updated.id),
      )

      setNotice(
        decision === 'verified'
          ? 'Report approved. You can find it in Approved.'
          : 'Report rejected. You can find it in Rejected.',
      )
    } catch (caught) {
      if (mountedRef.current) {
        setNeedsReload(true)
      }

      throw caught
    } finally {
      busyRef.current = false

      if (mountedRef.current) {
        setReviewing(false)
      }
    }
  }

  if (loading) {
    return (
      <p className="section-note" role="status">
        Checking access and loading reports…
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
          onClick={reload}
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="reviewer-toolbar">
        <button
          className="button button-secondary"
          type="button"
          disabled={reviewing}
          onClick={reload}
        >
          Reload list
        </button>
      </div>

      {notice && (
        <p className="form-message form-message-success" role="status">
          {notice}
        </p>
      )}

      {needsReload && (
        <p className="form-message form-message-error" role="alert">
          The last decision could not be confirmed.
          Reload this list before making another decision.
        </p>
      )}

      {reports.length === 0 && (
        <p className="section-note">
          {mine
            ? 'No reports match your decisions on this page.'
            : 'No reports in this view on this page.'}
        </p>
      )}

      <div className="reviewer-list" aria-busy={reviewing}>
        {reports.map((report) =>
          reviewStatus === 'pending' ? (
            <ReviewCard
              key={report.id}
              report={report}
              onReview={handleReview}
              disabled={reviewing || needsReload}
            />
          ) : (
            <ReviewedReportCard
              key={report.id}
              report={report}
            />
          ),
        )}
      </div>

      {(offset > 0 || hasNext) && (
        <div className="reviewer-toolbar">
          <button
            className="button button-secondary"
            type="button"
            disabled={reviewing || offset === 0}
            onClick={() => changePage(Math.max(0, offset - 50))}
          >
            Previous
          </button>

          <button
            className="button button-secondary"
            type="button"
            disabled={reviewing || !hasNext}
            onClick={() => changePage(offset + 50)}
          >
            Next
          </button>
        </div>
      )}
    </>
  )
}

function AdminDashboard() {
  const [reviewStatus, setReviewStatus] =
    useState<ReportStatus>('pending')

  const [mine, setMine] = useState(false)

  return (
    <>
      <nav className="admin-view-switcher" aria-label="Report views">
        {views.map((view) => (
          <button
            key={view.value}
            className={
              reviewStatus === view.value
                ? 'button button-primary'
                : 'button button-secondary'
            }
            type="button"
            aria-pressed={reviewStatus === view.value}
            onClick={() => {
              setReviewStatus(view.value)

              if (view.value === 'pending') {
                setMine(false)
              }
            }}
          >
            {view.label}
          </button>
        ))}
      </nav>

      {reviewStatus !== 'pending' && (
        <label className="admin-mine-filter">
          <input
            type="checkbox"
            checked={mine}
            onChange={(event) => setMine(event.target.checked)}
          />
          Only my decisions
        </label>
      )}

      <ReportQueue
        key={`${reviewStatus}:${mine}`}
        reviewStatus={reviewStatus}
        mine={mine}
      />
    </>
  )
}

export default function ReviewerPanel() {
  const { user, loading } = useAuth()

  return (
    <section className="section-container content-section">
      <h1 className="section-title">Admin Dashboard</h1>

      {loading ? (
        <p className="section-note" role="status">
          Checking login…
        </p>
      ) : user ? (
        <AdminDashboard key={user.uid} />
      ) : (
        <div className="info-card">
          <p>Please sign in with your authorized admin account.</p>
          <AuthControls />
        </div>
      )}
    </section>
  )
}