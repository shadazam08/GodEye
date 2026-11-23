import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'

type ConnectionStatus = 'checking' | 'connected' | 'error'

function BackendStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('checking')

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    // Stop waiting if the backend takes more than five seconds.
    const timeout = window.setTimeout(() => {
      controller.abort()
    }, 5000)

    async function checkBackend() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/health`,
          { signal: controller.signal },
        )

        if (!response.ok) {
          throw new Error('Backend returned an unsuccessful response.')
        }

        const data = await response.json()

        if (data.status !== 'ok' || data.service !== 'GodEye API') {
          throw new Error('Unexpected backend response.')
        }

        if (!cancelled) {
          setStatus('connected')
        }
      } catch {
        if (!cancelled) {
          setStatus('error')
        }
      } finally {
        window.clearTimeout(timeout)
      }
    }

    void checkBackend()

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  const messages: Record<ConnectionStatus, string> = {
    checking: 'Checking backend connection…',
    connected: 'Backend connected — GodEye API is responding.',
    error: 'Cannot reach the backend. Start the Python server and refresh.',
  }

  const colors: Record<ConnectionStatus, string> = {
    checking: '#cbd5e1',
    connected: '#86efac',
    error: '#fda4af',
  }

  return (
    <div className="section-container">
      <p
        role="status"
        style={{
          padding: '14px 18px',
          border: '1px solid #334155',
          borderRadius: '10px',
          background: '#101b2c',
          color: colors[status],
          fontSize: '14px',
        }}
      >
        {messages[status]}
      </p>
    </div>
  )
}

export default BackendStatus