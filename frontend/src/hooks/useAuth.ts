import { useCallback, useEffect, useRef, useState } from "react";
import { FirebaseError } from "firebase/app";
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import type { User } from "firebase/auth";

import { auth, googleProvider } from "../lib/firebase";

function authErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return "Login could not be completed. Please try again.";
  }

  switch (error.code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";

    case "auth/popup-blocked":
      return "Allow browser pop-ups for this website, then try again.";

    case "auth/unauthorized-domain":
      return "This website domain is not authorized in Firebase.";

    case "auth/network-request-failed":
      return "Check your internet connection and try again.";

    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled for this Firebase project.";

    default:
      return "Authentication failed. Please try again.";
  }
}

export function useAuth() {
  const actionBusyRef = useRef(false);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      () => {
        setUser(null);
        setLoading(false);
        setError("Could not check your login session. Refresh and try again.");
      },
    );

    return unsubscribe;
  }, []);

  const runAuthAction = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      if (actionBusyRef.current || loading) {
        return false;
      }

      actionBusyRef.current = true;
      setActionLoading(true);
      setError("");

      try {
        await action();
        return true;
      } catch (caughtError) {
        setError(authErrorMessage(caughtError));
        return false;
      } finally {
        actionBusyRef.current = false;
        setActionLoading(false);
      }
    },
    [loading],
  );

  function signInWithGoogle(): Promise<boolean> {
    return runAuthAction(() => signInWithPopup(auth, googleProvider));
  }

  function signOut(): Promise<boolean> {
    return runAuthAction(() => firebaseSignOut(auth));
  }

  return {
    user,
    loading,
    actionLoading,
    error,
    signInWithGoogle,
    signOut,
  };
}
