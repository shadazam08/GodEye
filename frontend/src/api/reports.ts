import { auth } from '../lib/firebase'
import { API_BASE_URL } from '../config'
import type { ReportCreate, ReportRead } from '../types/report'

export async function submitReport(
  payload: ReportCreate,
  photo: File,
): Promise<ReportRead> {
  if (!API_BASE_URL) {
    throw new Error('The API address is not configured.')
  }

  if (!photo || photo.size === 0) {
    throw new Error('Please select a photo of the road damage.')
  }

  if (photo.size > 3 * 1024 * 1024) {
    throw new Error('Please select a photo of 3 MiB or smaller.')
  }

  if (!['image/jpeg', 'image/png'].includes(photo.type)) {
    throw new Error('Please select a JPEG or PNG photo.')
  }

  const user = auth.currentUser

  if (!user) {
    throw new Error('Please sign in to submit a report.')
  }

  const uid = user.uid
  const token = await user.getIdToken()

  if (auth.currentUser?.uid !== uid) {
    throw new Error('Your account changed. Please try again.')
  }

  const body = new FormData()
  body.append('payload', JSON.stringify(payload))
  body.append('file', photo)

  const controller = new AbortController()
  const timeout = window.setTimeout(
    () => controller.abort(),
    45_000,
  )

  try {
    const response = await fetch(`${API_BASE_URL}/api/reports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body,
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    })

    if (auth.currentUser?.uid !== uid) {
      throw new Error(
        'Your account changed. Check My Reports in the original ' +
          'account before submitting again.',
      )
    }

    if (response.status === 401) {
      throw new Error('Please sign in again.')
    }

    if (response.status === 403) {
      throw new Error('A verified email is required to submit reports.')
    }

    if (response.status === 413) {
      throw new Error('Please select a photo of 3 MiB or smaller.')
    }

    if (response.status === 400) {
      throw new Error(
        'The photo could not be accepted. Select a valid JPEG or PNG.',
      )
    }

    if (response.status === 422) {
      throw new Error(
        'Check the report details, selected location and required photo.',
      )
    }

    if (!response.ok) {
      throw new Error(
        'Submission could not be confirmed. Check My Reports ' +
          'before submitting again.',
      )
    }

    const report: ReportRead = await response.json()

    if (auth.currentUser?.uid !== uid) {
      throw new Error(
        'Your account changed. Check My Reports in the original account.',
      )
    }

    return report
  } catch (error) {
    if (
      error instanceof TypeError ||
      error instanceof SyntaxError ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      throw new Error(
        'Submission could not be confirmed. Check My Reports ' +
          'before submitting again.',
        { cause: error },
      )
    }

    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}