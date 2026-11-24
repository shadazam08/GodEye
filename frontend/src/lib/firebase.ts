import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

function requiredSetting(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      `Missing Firebase setting: ${name}. Check frontend/.env.local.`,
    )
  }

  return value.trim()
}

const firebaseConfig = {
  apiKey: requiredSetting(
    'VITE_FIREBASE_API_KEY',
    import.meta.env.VITE_FIREBASE_API_KEY,
  ),

  authDomain: requiredSetting(
    'VITE_FIREBASE_AUTH_DOMAIN',
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  ),

  projectId: requiredSetting(
    'VITE_FIREBASE_PROJECT_ID',
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
  ),

  appId: requiredSetting(
    'VITE_FIREBASE_APP_ID',
    import.meta.env.VITE_FIREBASE_APP_ID,
  ),
}

const firebaseApp =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp()

export const auth = getAuth(firebaseApp)

export const googleProvider = new GoogleAuthProvider()

googleProvider.setCustomParameters({
  prompt: 'select_account',
})