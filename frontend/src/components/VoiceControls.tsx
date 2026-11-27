import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react'

import { Capacitor } from '@capacitor/core'
import NativeVoiceControls from './NativeVoiceControls'

type VoiceLanguage = 'hi-IN' | 'en-IN'

export type VoiceControlsHandle = {
    activate: () => void
    announceReport: (
        reportId: string,
        onStarted: () => void,
    ) => boolean
    cancelReport: () => void
}

function readPreferences(): {
    muted: boolean
    language: VoiceLanguage
} {
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
        // Use defaults when storage is unavailable or invalid.
    }

    return { muted: false, language: 'hi-IN' }
}

const BrowserVoiceControls = forwardRef<VoiceControlsHandle>(
    function BrowserVoiceControls(_, ref) {
        const [preferences, setPreferences] = useState(readPreferences)
        const [message, setMessage] = useState('')
        const [needsActivation, setNeedsActivation] = useState(false)

        const [supported] = useState(
            () =>
                typeof window !== 'undefined' &&
                'speechSynthesis' in window &&
                'SpeechSynthesisUtterance' in window,
        )

        const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
        const activatedRef = useRef(false)
        const timerRef = useRef<number | null>(null)
        const reportIdRef = useRef<string | null>(null)

        useEffect(() => {
            try {
                localStorage.setItem(
                    'godeye.voice.preferences',
                    JSON.stringify(preferences),
                )
            } catch {
                // Controls still work when preferences cannot be saved.
            }
        }, [preferences])

        useEffect(() => {
            if (!supported) return

            const synthesis = window.speechSynthesis
            synthesis.getVoices()

            function cancelCurrent() {
                const current = utteranceRef.current
                utteranceRef.current = null

                if (timerRef.current !== null) {
                    window.clearTimeout(timerRef.current)
                    timerRef.current = null
                }

                if (current) synthesis.cancel()
            }

            function handleVisibility() {
                if (document.hidden) cancelCurrent()
            }

            document.addEventListener('visibilitychange', handleVisibility)

            return () => {
                document.removeEventListener(
                    'visibilitychange',
                    handleVisibility,
                )
                cancelCurrent()
            }
        }, [supported])

        function stopSpeech() {
            reportIdRef.current = null
            const current = utteranceRef.current
            utteranceRef.current = null

            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current)
                timerRef.current = null
            }

            if (supported && current) {
                window.speechSynthesis.cancel()
            }
        }

        function activate(nextPreferences = preferences) {
            if (
                !supported ||
                nextPreferences.muted ||
                document.hidden ||
                activatedRef.current ||
                utteranceRef.current
            ) {
                return
            }

            const synthesis = window.speechSynthesis
            // const language = preferences.language
            const language = nextPreferences.language

            const utterance = new SpeechSynthesisUtterance(
                language === 'hi-IN'
                    ? 'गॉड आई की आवाज़ चालू है।'
                    : 'GodEye sound is on.',
            )

            const voices = synthesis.getVoices()
            const selectedVoice = voices.find(
                (voice) =>
                    voice.lang.toLowerCase().replace('_', '-')
                        .split('-')[0] === language.split('-')[0],
            )

            utterance.lang = language
            if (selectedVoice) utterance.voice = selectedVoice
            utterance.rate = 0.95
            utterance.volume = 1

            function failed() {
                if (utteranceRef.current !== utterance) return

                stopSpeech()
                activatedRef.current = false
                setNeedsActivation(true)
                setMessage(
                    'Sound could not start. Check device volume and browser sound ' +
                    'settings, or try another language.'
                )
            }

            utterance.onstart = () => {
                if (utteranceRef.current !== utterance) return

                if (timerRef.current !== null) {
                    window.clearTimeout(timerRef.current)
                    timerRef.current = null
                }

                activatedRef.current = true
                setNeedsActivation(false)
                setMessage('')
            }

            utterance.onend = () => {
                if (utteranceRef.current !== utterance) return

                if (!activatedRef.current) {
                    failed()
                    return
                }

                stopSpeech()
            }

            utterance.onerror = failed
            utteranceRef.current = utterance
            setMessage('')

            timerRef.current = window.setTimeout(failed, 10_000)

            try {
                synthesis.speak(utterance)
            } catch {
                failed()
            }
        }

        function cancelReport() {
            if (reportIdRef.current !== null) {
                stopSpeech()
            }
        }

        function announceReport(
            reportId: string,
            onStarted: () => void,
        ): boolean {
            if (
                !supported ||
                preferences.muted ||
                document.hidden ||
                !activatedRef.current ||
                utteranceRef.current
            ) {
                return false
            }

            const language = preferences.language
            const synthesis = window.speechSynthesis

            const utterance = new SpeechSynthesisUtterance(
                language === 'hi-IN'
                    ? 'आपके नियोजित रास्ते के पास सड़क खराब होने की रिपोर्ट है। सावधानी से चलें।'
                    : 'Road damage has been reported near your planned route. Proceed with caution.',
            )

            const voice = synthesis.getVoices().find(
                (item) =>
                    item.lang.toLowerCase().replace('_', '-')
                        .split('-')[0] === language.split('-')[0],
            )

            utterance.lang = language
            if (voice) utterance.voice = voice
            utterance.rate = 0.95
            utterance.volume = 1

            function failed() {
                if (utteranceRef.current !== utterance) return

                stopSpeech()
                activatedRef.current = false
                setNeedsActivation(true)
                setMessage(
                    'Sound could not play. Check your volume or enable sound again.',
                )
            }

            utterance.onstart = () => {
                if (utteranceRef.current !== utterance) return

                if (timerRef.current !== null) {
                    window.clearTimeout(timerRef.current)
                    timerRef.current = null
                }

                setMessage('')
                onStarted()
            }

            utterance.onend = () => {
                if (utteranceRef.current !== utterance) return
                stopSpeech()
            }

            utterance.onerror = failed

            reportIdRef.current = reportId
            utteranceRef.current = utterance
            timerRef.current = window.setTimeout(failed, 10_000)

            try {
                synthesis.speak(utterance)
                return true
            } catch {
                failed()
                return false
            }
        }

        useImperativeHandle(ref, () => ({
            activate,
            announceReport,
            cancelReport,
        }))

        if (!supported) {
            return (
                <p className="voice-unavailable">
                    Voice is unavailable in this browser.
                </p>
            )
        }

        return (
            <section className="voice-toolbar" aria-label="Sound settings">
                <div className="voice-toolbar-controls">
                    <button
                        className="voice-mute-button"
                        type="button"
                        aria-label={preferences.muted ? 'Unmute voice' : 'Mute voice'}
                        aria-pressed={preferences.muted}
                        onClick={() => {
                            const nextPreferences = {
                                ...preferences,
                                muted: !preferences.muted,
                            }

                            stopSpeech()
                            activatedRef.current = false
                            setNeedsActivation(false)
                            setMessage('')
                            setPreferences(nextPreferences)

                            if (!nextPreferences.muted) {
                                activate(nextPreferences)
                            }
                        }}
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

                            if (language !== 'hi-IN' && language !== 'en-IN') return

                            const nextPreferences: {
                                muted: boolean
                                language: VoiceLanguage
                            } = {
                                ...preferences,
                                language,
                            }

                            stopSpeech()
                            activatedRef.current = false
                            setMessage('')
                            setNeedsActivation(false)
                            setPreferences(nextPreferences)
                            activate(nextPreferences)
                        }}
                    >
                        <option value="hi-IN">हिन्दी</option>
                        <option value="en-IN">English</option>
                    </select>
                </div>

                {needsActivation && !preferences.muted && (
                    <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => activate()}
                    >
                        Enable sound
                    </button>
                )}

                {message && (
                    <p role="status">{message}</p>
                )}
            </section>
        )
    },


)

const VoiceControls = forwardRef<VoiceControlsHandle>(
    function VoiceControls(_, ref) {
        return Capacitor.isNativePlatform()
            ? <NativeVoiceControls ref={ref} />
            : <BrowserVoiceControls ref={ref} />
    },
)

export default VoiceControls