import { auth } from '../lib/firebase'
import { API_BASE_URL } from '../config'
import type { ReportCreate, ReportRead } from '../types/report'

export async function submitReport(
  payload: ReportCreate,
): Promise<ReportRead> {
  const currentUser = auth.currentUser

  if (!currentUser) {
    throw new Error('Report bhejne ke liye pehle login karein.')
  }

  let token: string

  try {
    token = await currentUser.getIdToken()
  } catch {
    throw new Error('Login refresh nahi ho saka. Dobara sign in karein.')
  }

  if (auth.currentUser?.uid !== currentUser.uid) {
    throw new Error('Login session badal gaya hai. Dobara try karein.')
  }

  const controller = new AbortController()

  const timeout = window.setTimeout(() => {
    controller.abort()
  }, 20000)

  try {
    let response: Response

    try {
      response = await fetch(`${API_BASE_URL}/api/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch {
      throw new Error(
        'Submission confirm nahi ho saka. Report server tak pahunch ' +
          'sakti hai; dobara bhejne se pehle uska status check karein.',
      )
    }

    if (response.status === 401) {
      throw new Error('Login verify nahi hua. Logout karke dobara login karein.')
    }

    if (response.status === 403) {
      throw new Error('Report bhejne ke liye verified email required hai.')
    }

    if (response.status === 422) {
      throw new Error('Report ki details ya coordinates check karein.')
    }

    if (!response.ok) {
      throw new Error(
        'Report save hone ki confirmation nahi mili. Please try again later.',
      )
    }

    try {
      const report: ReportRead = await response.json()
      return report
    } catch {
      throw new Error(
        'Server response read nahi hua. Report save ho sakti hai; ' +
          'dobara submit karne se pehle status check karein.',
      )
    }
  } finally {
    window.clearTimeout(timeout)
  }
}