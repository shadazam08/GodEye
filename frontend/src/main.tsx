import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import StartupBoundary from './components/StartupBoundary'
import StartupError from './components/StartupError'

import './index.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('GodEye root element is missing.')
}

const root = createRoot(container)
let failed = false

function showFailure(error: unknown) {
  if (failed) return

  failed = true
  root.render(<StartupError error={error} />)
}

window.addEventListener('error', (event) => {
  if (event instanceof ErrorEvent) {
    showFailure(event.error ?? event.message)
  }
})

window.addEventListener('unhandledrejection', (event) => {
  showFailure(event.reason)
})

// Import after error handlers are registered.
// Firebase/module initialization errors are caught here.
void import('./App.tsx')
  .then(({ default: App }) => {
    if (failed) return

    root.render(
      <StrictMode>
        <StartupBoundary>
          <App />
        </StartupBoundary>
      </StrictMode>,
    )
  })
  .catch(showFailure)