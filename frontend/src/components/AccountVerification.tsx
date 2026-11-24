import { useRef, useState } from 'react'

import { getMyAccount } from '../api/account'
import { useAuth } from '../hooks/useAuth'

interface VerificationResult {
  uid: string
  success: boolean
  message: string
}

function AccountVerification() {
  const checkingRef = useRef(false)

  const { user, loading } = useAuth()

  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)

  async function handleCheck() {
    if (!user || checkingRef.current) {
      return
    }

    const requestedUid = user.uid

    checkingRef.current = true
    setIsChecking(true)
    setResult(null)

    try {
      const account = await getMyAccount()

      setResult({
        uid: account.uid,
        success: true,
        message: account.email_verified
          ? 'Backend verified your login. Email is verified.'
          : 'Backend verified your login. Email is not verified.',
      })
    } catch (caughtError) {
      setResult({
        uid: requestedUid,
        success: false,
        message:
          caughtError instanceof Error
            ? caughtError.message
            : 'Account verification failed.',
      })
    } finally {
      checkingRef.current = false
      setIsChecking(false)
    }
  }

  if (loading || !user) {
    return null
  }

  const visibleResult = result?.uid === user.uid ? result : null

  return (
    <div className="section-container">
      <div className="tracking-panel">
        <h3>Local account verification</h3>

        <p className="section-note">
          Checks whether the Python backend accepts your Firebase
          login token. Tokens are not displayed.
        </p>

        <button
          className="button button-secondary"
          type="button"
          onClick={() => void handleCheck()}
          disabled={isChecking}
        >
          {isChecking ? 'Verifying…' : 'Check backend login'}
        </button>

        {visibleResult && (
          <p
            className={
              visibleResult.success
                ? 'form-message form-message-success'
                : 'form-message form-message-error'
            }
            role={visibleResult.success ? 'status' : 'alert'}
          >
            {visibleResult.message}
          </p>
        )}
      </div>
    </div>
  )
}

export default AccountVerification