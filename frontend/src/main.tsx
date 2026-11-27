import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

function showStartupError(error: unknown) {
  if (document.getElementById('godeye-startup-error')) return

  const original =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown startup error.'

  const message = original
    .replace(/https?:\/\/[^\s)]+/gi, '[URL]')
    .replace(/\bAIza[A-Za-z0-9_-]+\b/g, '[API key]')
    .replace(/\beyJ[A-Za-z0-9_.-]+\b/g, '[token]')
    .slice(0, 500)

  const panel = document.createElement('div')
  panel.id = 'godeye-startup-error'
  panel.setAttribute('role', 'alert')

  Object.assign(panel.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    overflow: 'auto',
    padding: '32px 20px',
    background: '#0b1220',
    color: '#ffffff',
    fontFamily: 'Arial, sans-serif',
    lineHeight: '1.7',
  })

  const title = document.createElement('h2')
  title.textContent = 'GodEye could not start'

  const version = document.createElement('p')
  version.textContent = 'Android startup check 1'

  const details = document.createElement('pre')
  details.textContent = message
  details.style.whiteSpace = 'pre-wrap'
  details.style.overflowWrap = 'anywhere'

  const guidance = document.createElement('p')
  guidance.textContent =
    'Please share a screenshot of this error so we can fix the cause.'

  panel.append(title, version, details, guidance)
  document.body.appendChild(panel)
}

window.addEventListener('error', (event) => {
  showStartupError(event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  showStartupError(event.reason)
})

const container = document.getElementById('root')

if (!container) {
  showStartupError(new Error('The application root element is missing.'))
} else {
  const root = createRoot(container, {
    onUncaughtError: showStartupError,
  })

  import('./App.tsx')
    .then(({ default: App }) => {
      root.render(
        <StrictMode>
          <App />
        </StrictMode>,
      )
    })
    .catch(showStartupError)
}