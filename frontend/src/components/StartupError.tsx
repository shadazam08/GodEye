function describeError(error: unknown): string {
    let message: string

    if (error instanceof Error) {
        message = `${error.name}: ${error.message}`
    } else if (typeof error === 'string') {
        message = error
    } else {
        message = 'Unknown startup error'
    }

    return message
        .replace(/AIza[A-Za-z0-9_-]+/g, '[API KEY]')
        .replace(/\beyJ[A-Za-z0-9_.-]+/g, '[TOKEN]')
        .replace(/https?:\/\/[^\s"'<>]+/g, '[URL]')
        .slice(0, 500)
}

export default function StartupError({
    error,
}: {
    error: unknown
}) {
    return (
        <main
            style={{
                minHeight: '100dvh',
                padding: '32px 20px',
                background: '#0b1220',
                color: '#f8fafc',
                fontFamily: 'Arial, sans-serif',
            }}
        >
            <h1 style={{ fontSize: '24px' }}>
                GodEye could not start
            </h1>

            <p>Please share the error below so we can fix it.</p>

            <pre
                style={{
                    padding: '16px',
                    border: '1px solid #64748b',
                    borderRadius: '12px',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    fontSize: '14px',
                    lineHeight: 1.6,
                }}
            >
                {describeError(error)}
            </pre>

            <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                    padding: '12px 20px',
                    border: 0,
                    borderRadius: '10px',
                    background: '#a9e2ee',
                    color: '#0b1220',
                    fontSize: '16px',
                }}
            >
                Retry
            </button>
        </main>
    )
}