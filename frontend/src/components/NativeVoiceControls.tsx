import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import type { VoiceControlsHandle } from './VoiceControls'

type Preferences = {
    muted: boolean
    language: 'hi-IN' | 'en-IN'
}

type Operation = {
    reportId: string | null
    timer: number | null
}

function readPreferences(): Preferences {
    try {
        const saved: unknown = JSON.parse(
            localStorage.getItem('godeye.voice.preferences') ?? 'null',
        )

        if (typeof saved === 'object' && saved !== null) {
            const value = saved as Record<string, unknown>

            return {
                muted: value.muted === true,
                language: value.language === 'en-IN' ? 'en-IN' : 'hi-IN',
            }
        }
    } catch {
        // Use defaults when saved settings cannot be read.
    }

    return { muted: false, language: 'hi-IN' }
}

const NativeVoiceControls = forwardRef<VoiceControlsHandle>(
    function NativeVoiceControls(_, ref) {
        const [preferences, setPreferences] = useState(readPreferences)
        const [message, setMessage] = useState('')
        const [needsRetry, setNeedsRetry] = useState(false)

        const mountedRef = useRef(false)
        const activatedRef = useRef(false)
        const operationRef = useRef<Operation | null>(null)
        const commandsRef = useRef<Promise<void>>(Promise.resolve())

        const stopSpeech = useCallback(() => {
            const operation = operationRef.current
            operationRef.current = null

            if (operation && operation.timer !== null) {
                window.clearTimeout(operation.timer)
            }

            commandsRef.current = commandsRef.current
                .then(() => TextToSpeech.stop())
                .catch(() => undefined)
        }, [])

        const startSpeech = useCallback((
            text: string,
            language: Preferences['language'],
            reportId: string | null,
            onPlayed?: () => void,
        ): boolean => {
            if (
                !mountedRef.current ||
                document.hidden ||
                operationRef.current
            ) {
                return false
            }

            const operation: Operation = {
                reportId,
                timer: null,
            }

            operationRef.current = operation

            function isCurrent() {
                return mountedRef.current &&
                    operationRef.current === operation &&
                    !document.hidden
            }

            function failed(reason: string) {
                if (!isCurrent()) return

                activatedRef.current = false
                stopSpeech()
                setNeedsRetry(true)
                setMessage(reason)
            }

            const failureMessage =
                'Voice could not play. Check media volume, then try again.'

            operation.timer = window.setTimeout(
                () => failed(failureMessage),
                30_000,
            )

            commandsRef.current = commandsRef.current
                .then(async () => {
                    if (!isCurrent()) return

                    // Allow a short time for Android's speech engine to start.
                    for (let attempt = 0; ; attempt += 1) {
                        try {
                            await TextToSpeech.stop()
                            break
                        } catch (error) {
                            if (attempt === 5) throw error

                            await new Promise<void>((resolve) => {
                                window.setTimeout(resolve, 400)
                            })

                            if (!isCurrent()) return
                        }
                    }

                    if (!isCurrent()) return

                    const { supported } =
                        await TextToSpeech.isLanguageSupported({
                            lang: language,
                        })

                    if (!isCurrent()) return

                    if (!supported) {
                        failed(
                            language === 'hi-IN'
                                ? 'Hindi voice is unavailable. Enable Hindi in your phone’s text-to-speech settings, or select English.'
                                : 'English voice is unavailable. Check your phone’s text-to-speech settings.',
                        )
                        return
                    }

                    setMessage('')
                    setNeedsRetry(false)

                    // Playback stays outside the command queue so cancellation
                    // cannot block the next announcement.
                    void TextToSpeech.speak({
                        text,
                        lang: language,
                        rate: 0.95,
                        pitch: 1,
                        volume: 1,
                    }).then(() => {
                        if (!isCurrent()) return

                        if (operation.timer !== null) {
                            window.clearTimeout(operation.timer)
                        }

                        operationRef.current = null
                        activatedRef.current = true

                        setNeedsRetry(false)
                        setMessage('')

                        // Android confirms completion. Only a completed,
                        // uncancelled announcement consumes this callback.
                        onPlayed?.()
                    }).catch(() => failed(failureMessage))
                })
                .catch(() => failed(failureMessage))

            return true
        }, [stopSpeech])

        const activate = useCallback(() => {
            if (preferences.muted || activatedRef.current) return

            startSpeech(
                preferences.language === 'hi-IN'
                    ? 'गॉड आई की आवाज़ चालू है।'
                    : 'GodEye sound is on.',
                preferences.language,
                null,
            )
        }, [preferences, startSpeech])

        useEffect(() => {
            try {
                localStorage.setItem(
                    'godeye.voice.preferences',
                    JSON.stringify(preferences),
                )
            } catch {
                // Controls still work when settings cannot be saved.
            }
        }, [preferences])

        useEffect(() => {
            mountedRef.current = true

            function handleVisibility() {
                if (document.hidden) {
                    stopSpeech()
                } else {
                    activate()
                }
            }

            document.addEventListener(
                'visibilitychange',
                handleVisibility,
            )

            activate()

            return () => {
                mountedRef.current = false

                document.removeEventListener(
                    'visibilitychange',
                    handleVisibility,
                )

                stopSpeech()
            }
        }, [activate, stopSpeech])

        useImperativeHandle(ref, () => ({
            activate,

            announceReport(reportId, onStarted) {
                if (
                    preferences.muted ||
                    !activatedRef.current ||
                    !reportId
                ) {
                    return false
                }

                return startSpeech(
                    preferences.language === 'hi-IN'
                        ? 'आपके नियोजित रास्ते के पास सड़क खराब होने की रिपोर्ट है। सावधानी से चलें।'
                        : 'Road damage has been reported near your planned route. Proceed with caution.',
                    preferences.language,
                    reportId,
                    onStarted,
                )
            },

            cancelReport() {
                const operation = operationRef.current

                if (operation && operation.reportId !== null) {
                    stopSpeech()
                }
            },
        }), [activate, preferences, startSpeech, stopSpeech])

        function updatePreferences(next: Preferences) {
            stopSpeech()
            activatedRef.current = false

            setNeedsRetry(false)
            setMessage('')
            setPreferences(next)
        }

        return (
            <section
                className="voice-toolbar"
                aria-label="Sound settings"
            >
                <div className="voice-toolbar-controls">
                    <button
                        className="voice-mute-button"
                        type="button"
                        aria-label={
                            preferences.muted
                                ? 'Unmute voice'
                                : 'Mute voice'
                        }
                        aria-pressed={preferences.muted}
                        onClick={() => updatePreferences({
                            ...preferences,
                            muted: !preferences.muted,
                        })}
                    >
                        <span aria-hidden="true">
                            {preferences.muted ? '🔇' : '🔊'}
                        </span>

                        {preferences.muted ? 'Unmute' : 'Mute'}
                    </button>

                    <select
                        aria-label="Voice language"
                        value={preferences.language}
                        onChange={(event) => {
                            const language = event.target.value

                            if (
                                language !== 'hi-IN' &&
                                language !== 'en-IN'
                            ) {
                                return
                            }

                            updatePreferences({
                                ...preferences,
                                language,
                            })
                        }}
                    >
                        <option value="hi-IN">हिन्दी</option>
                        <option value="en-IN">English</option>
                    </select>
                </div>

                {needsRetry && !preferences.muted && (
                    <button
                        className="button button-secondary"
                        type="button"
                        onClick={activate}
                    >
                        Try sound
                    </button>
                )}

                {message && <p role="status">{message}</p>}
            </section>
        )
    },
)

export default NativeVoiceControls