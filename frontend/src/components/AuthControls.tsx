import { useAuth } from '../hooks/useAuth'

function AuthControls() {
    const {
        user,
        loading,
        actionLoading,
        error,
        signInWithGoogle,
        signOut,
    } = useAuth()

    if (loading) {
        return (
            <div className="auth-controls" role="status">
                <span className="auth-status">Loading…</span>
            </div>
        )
    }

    return (
        <div className="auth-controls" aria-busy={actionLoading}>
            {user ? (
                <div className="auth-session">
                    <span className="auth-status">
                        Hello , {user.displayName || 'User'}
                    </span>

                    <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => void signOut()}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Please wait…' : 'Logout'}
                    </button>
                </div>
            ) : (
                <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    disabled={actionLoading}
                >
                    {actionLoading ? 'Please wait…' : 'Login'}
                </button>
            )}

            {error && (
                <p className="auth-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    )
}

export default AuthControls