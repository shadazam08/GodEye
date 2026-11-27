import { Capacitor } from '@capacitor/core'
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth'

import { auth, googleProvider } from './firebase'

export async function signInToGodEye(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    await signInWithPopup(auth, googleProvider)
    return
  }

  const { FirebaseAuthentication } = await import(
    '@capacitor-firebase/authentication'
  )

  const result = await FirebaseAuthentication.signInWithGoogle({
    skipNativeAuth: true,
  })

  const idToken = result.credential?.idToken

  if (!idToken) {
    throw new Error('Google sign-in did not return a valid credential.')
  }

  const credential = GoogleAuthProvider.credential(idToken)

  await signInWithCredential(auth, credential)
}

export async function signOutOfGodEye(): Promise<void> {
  // Clear the session used by the UI and API requests.
  await firebaseSignOut(auth)

  if (Capacitor.isNativePlatform()) {
    const { FirebaseAuthentication } = await import(
      '@capacitor-firebase/authentication'
    )

    await FirebaseAuthentication.signOut()
  }
}