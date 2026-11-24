import { auth } from '../lib/firebase'
import { API_BASE_URL } from '../config'
import type { ReportRead } from '../types/report'

export interface AccountIdentity {
  uid: string
  email: string | null
  email_verified: boolean
  name: string | null
}

function isAccountIdentity(value: unknown): value is AccountIdentity {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false
  }

  const account = value as Record<string, unknown>

  return (
    typeof account.uid === 'string' &&
    account.uid.length > 0 &&
    typeof account.email_verified === 'boolean' &&
    (account.email === null || typeof account.email === 'string') &&
    (account.name === null || typeof account.name === 'string')
  )
}

export async function getMyAccount(): Promise<AccountIdentity> {
  const currentUser = auth.currentUser

  if (!currentUser) {
    throw new Error('Please log in first.')
  }

  // Firebase refreshes the token when needed.
  const token = await currentUser.getIdToken()

  const controller = new AbortController()

  const timeout = window.setTimeout(() => {
    controller.abort()
  }, 15000)

  try {
    let response: Response

    try {
      response = await fetch(`${API_BASE_URL}/api/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
        cache: 'no-store',
      })
    } catch {
      throw new Error(
        'Could not reach account verification. Check your connection.',
      )
    }

    if (response.status === 401) {
      throw new Error('Your login could not be verified. Log out and sign in again.')
    }

    if (response.status === 503) {
      throw new Error(
        'Account verification is temporarily unavailable.',
      )
    }

    if (!response.ok) {
      throw new Error('Could not verify your account.')
    }

    const account: unknown = await response.json()

    if (!isAccountIdentity(account)) {
      throw new Error('The server returned an unexpected account response.')
    }

    if (
      account.uid !== currentUser.uid ||
      auth.currentUser?.uid !== currentUser.uid
    ) {
      throw new Error('The login session changed. Please try again.')
    }

    return account
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function getMyReports(
  offset = 0,
): Promise<ReportRead[]> {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('Invalid report-list offset.')
  }

  const currentUser = auth.currentUser

  if (!currentUser) {
    throw new Error('Apni reports dekhne ke liye login karein.')
  }

  let token: string

  try {
    token = await currentUser.getIdToken()
  } catch {
    throw new Error('Login refresh nahi hua. Dobara sign in karein.')
  }

  if (auth.currentUser?.uid !== currentUser.uid) {
    throw new Error('Login session badal gaya hai. Dobara try karein.')
  }

  const controller = new AbortController()

  const timeout = window.setTimeout(() => {
    controller.abort()
  }, 15000)

  try {
    let response: Response

    try {
      response = await fetch(
        `${API_BASE_URL}/api/my/reports?limit=20&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
          cache: 'no-store',
        },
      )
    } catch {
      throw new Error(
        'Reports load nahi hui. Connection check karke dobara try karein.',
      )
    }

    if (response.status === 401) {
      throw new Error('Login verify nahi hua. Dobara sign in karein.')
    }

    if (!response.ok) {
      throw new Error('Reports abhi load nahi ho sakin. Baad mein try karein.')
    }

    let data: unknown

    try {
      data = await response.json()
    } catch {
      throw new Error('Reports ka server response read nahi hua.')
    }

    if (!Array.isArray(data)) {
      throw new Error('Unexpected reports response.')
    }

    if (auth.currentUser?.uid !== currentUser.uid) {
      throw new Error('Login session badal gaya hai. Dobara try karein.')
    }

    // Individual report fields are validated by the backend ReportRead model.
    return data as ReportRead[]
  } finally {
    window.clearTimeout(timeout)
  }
}