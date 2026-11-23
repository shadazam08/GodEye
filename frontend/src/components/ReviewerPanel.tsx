import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  getReviewerReports,
  submitReview,
} from '../api/reviewer'
import type { ReviewDecision } from '../api/reviewer'
import type { ReportRead } from '../types/report'

import ReviewCard from './ReviewCard'

function ReviewerPanel() {
  const requestIdRef = useRef(0)
  const reviewBusyRef = useRef(false)

  const [keyInput, setKeyInput] = useState('')
  const [activeKey, setActiveKey] = useState('')
  const [reports, setReports] = useState<ReportRead[]>([])
  const [offset, setOffset] = useState(0)
  const [hasNextBatch, setHasNextBatch] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [needsRefresh, setNeedsRefresh] = useState(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadReports(key: string, nextOffset = 0) {
    if (reviewBusyRef.current) {
      return
    }

    const requestId = ++requestIdRef.current

    setIsLoading(true)
    setError('')
    setNotice('')

    try {
      const data = await getReviewerReports(
        key,
        'pending',
        nextOffset,
      )

      if (requestId !== requestIdRef.current) {
        return
      }

      setReports(data)
      setOffset(nextOffset)
      setHasNextBatch(data.length === 50)
      setActiveKey(key)
      setKeyInput('')
      setNeedsRefresh(false)
    } catch (caughtError) {
      if (requestId !== requestIdRef.current) {
        return
      }

      setNeedsRefresh(true)
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not load reports.',
      )
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }

  function handleAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isLoading) {
      return
    }

    void loadReports(keyInput.trim())
  }

  async function handleReview(
    reportId: string,
    decision: ReviewDecision,
    reason: string,
  ): Promise<void> {
    if (
      !activeKey ||
      isLoading ||
      reviewBusyRef.current ||
      needsRefresh
    ) {
      throw new Error(
        'Wait for the current request or refresh the report queue.',
      )
    }

    const requestId = ++requestIdRef.current

    reviewBusyRef.current = true
    setIsReviewing(true)
    setError('')
    setNotice('')

    try {
      const updatedReport = await submitReview(
        activeKey,
        reportId,
        decision,
        reason,
      )

      if (requestId !== requestIdRef.current) {
        return
      }

      setReports((currentReports) =>
        currentReports.filter(
          (report) => report.id !== updatedReport.id,
        ),
      )

      setNotice(
        `Report "${updatedReport.title}" marked as ` +
          `${updatedReport.status}. Review history saved.`,
      )
    } catch (caughtError) {
      if (requestId === requestIdRef.current) {
        setNeedsRefresh(true)
      }

      throw caughtError
    } finally {
      if (requestId === requestIdRef.current) {
        reviewBusyRef.current = false
        setIsReviewing(false)
      }
    }
  }

  function handleLogout() {
    requestIdRef.current += 1
    reviewBusyRef.current = false

    setActiveKey('')
    setKeyInput('')
    setReports([])
    setOffset(0)
    setHasNextBatch(false)
    setError('')
    setNotice('')
    setIsLoading(false)
    setIsReviewing(false)
    setNeedsRefresh(false)
  }

  return (
    <section
      className="section-container content-section"
      id="reviewer-panel"
      aria-labelledby="reviewer-panel-title"
    >
      <span className="eyebrow">AUTHORIZED REVIEWERS</span>

      <h2 className="section-title" id="reviewer-panel-title">
        Review community reports
      </h2>

      <p className="section-note">
        Reviewer access is required. Verify a report only when
        supporting evidence establishes the hazard. Reject synthetic
        test submissions.
      </p>

      {!activeKey && (
        <form className="report-form" onSubmit={handleAccess}>
          <div className="form-field">
            <label htmlFor="reviewer-key">Reviewer key</label>

            <input
              id="reviewer-key"
              name="reviewer_key"
              type="password"
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={isLoading}
              required
            />
          </div>

          <button
            className="button button-primary"
            type="submit"
            disabled={isLoading || !keyInput.trim()}
          >
            {isLoading ? 'Checking access…' : 'Open review queue'}
          </button>
        </form>
      )}

      {activeKey && (
        <>
          <div className="reviewer-toolbar">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void loadReports(activeKey, offset)}
              disabled={isLoading || isReviewing}
            >
              {isLoading ? 'Loading…' : 'Refresh pending reports'}
            </button>

            <button
              className="button button-secondary"
              type="button"
              onClick={handleLogout}
            >
              Clear reviewer access
            </button>
          </div>

          <p className="section-note" role="status">
            {isLoading
              ? 'Loading report queue…'
              : `${reports.length} pending reports in this batch.`}
          </p>

          {notice && (
            <p
              className="form-message form-message-success"
              role="status"
            >
              {notice}
            </p>
          )}

          {needsRefresh && (
            <p className="section-note" role="status">
              Refresh pending reports before making another decision.
              The last request may already have reached the server.
            </p>
          )}

          {reports.length === 0 && !isLoading && !error && (
            <p className="section-note">
              No pending reports in this batch.
            </p>
          )}

          <div
            className="reviewer-list"
            aria-busy={isLoading || isReviewing}
          >
            {reports.map((report) => (
              <ReviewCard
                key={report.id}
                report={report}
                onReview={handleReview}
                disabled={
                  isLoading || isReviewing || needsRefresh
                }
              />
            ))}
          </div>

          <div className="reviewer-toolbar">
            <button
              className="button button-secondary"
              type="button"
              disabled={
                isLoading || isReviewing || offset === 0
              }
              onClick={() =>
                void loadReports(activeKey, Math.max(0, offset - 50))
              }
            >
              Previous batch
            </button>

            <button
              className="button button-secondary"
              type="button"
              disabled={
                isLoading || isReviewing || !hasNextBatch
              }
              onClick={() => void loadReports(activeKey, offset + 50)}
            >
              Next batch
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="form-message form-message-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

export default ReviewerPanel