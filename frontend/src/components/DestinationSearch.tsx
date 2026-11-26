import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { searchDestinations } from '../api/navigation'
import type { Destination } from '../types/navigation'

type Props = {
    selected: Destination | null
    onSelect: (destination: Destination) => void
    onClear: () => void
}

export default function DestinationSearch({
    selected,
    onSelect,
    onClear,
}: Props) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<Destination[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [error, setError] = useState('')

    const requestRef = useRef(0)
    const controllerRef = useRef<AbortController | null>(null)
    const [editing, setEditing] = useState(false)

    useEffect(() => {
        return () => {
            requestRef.current += 1
            controllerRef.current?.abort()
        }
    }, [])

    function cancelSearch() {
        requestRef.current += 1
        controllerRef.current?.abort()
        controllerRef.current = null
    }

    async function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        const text = query.trim()

        if (text.length < 3 || text.length > 120) {
            setError('Enter a destination of 3 to 120 characters.')
            return
        }

        cancelSearch()

        const requestId = requestRef.current
        const controller = new AbortController()
        controllerRef.current = controller

        setLoading(true)
        setError('')
        setSearched(false)
        setResults([])
        onClear()

        const timeout = window.setTimeout(
            () => controller.abort(),
            20_000,
        )

        try {
            const destinations = await searchDestinations(
                text,
                controller.signal,
            )

            if (requestRef.current !== requestId) return

            setResults(destinations)
            setSearched(true)
        } catch (caught) {
            if (requestRef.current !== requestId) return

            setError(
                controller.signal.aborted
                    ? 'Search timed out. Please try again.'
                    : caught instanceof Error
                        ? caught.message
                        : 'Could not search destinations.',
            )
        } finally {
            window.clearTimeout(timeout)

            if (requestRef.current === requestId) {
                setLoading(false)
                controllerRef.current = null
            }
        }
    }

    if (selected && !editing) {
        return (
            <div className="destination-search destination-compact">
                <div className="destination-compact-row">
                    <span className="destination-pin" aria-hidden="true">
                        📍
                    </span>

                    <div className="destination-compact-text">
                        <span className="destination-caption">Going to</span>

                        <strong title={selected.label}>
                            {selected.label.split(',')[0]}
                        </strong>
                    </div>

                    <button
                        className="destination-change"
                        type="button"
                        onClick={() => {
                            cancelSearch()
                            setQuery('')
                            setResults([])
                            setSearched(false)
                            setLoading(false)
                            setError('')
                            setEditing(true)
                        }}
                    >
                        Edit destination
                    </button>
                </div>

                <p className="destination-full-address">
                    {selected.label}
                </p>
            </div>
        )
    }

    return (
        <div className="destination-search">
            <form onSubmit={handleSearch}>
                <label htmlFor="driver-destination">
                    Destination
                </label>

                <div className="destination-search-row">
                    <input
                        id="driver-destination"
                        type="search"
                        value={query}
                        minLength={3}
                        maxLength={120}
                        placeholder="Example: Darbhanga Junction"
                        autoComplete="off"
                        required
                        onChange={(event) => {
                            cancelSearch()
                            setQuery(event.target.value)
                            setResults([])
                            setSearched(false)
                            setLoading(false)
                            setError('')
                            onClear()
                        }}
                    />

                    <button
                        className="button button-primary"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? 'Searching…' : 'Search'}
                    </button>
                </div>
            </form>

            {error && (
                <p className="form-message form-message-error" role="alert">
                    {error}
                </p>
            )}

            {searched && results.length === 0 && (
                <p role="status">
                    No destination found. Try a road, landmark or city name.
                </p>
            )}

            {results.length > 0 && (
                <ul className="destination-results" aria-label="Destinations">
                    {results.map((destination) => (
                        <li key={destination.place_id}>
                            <button
                                type="button"
                                onClick={() => {
                                    setQuery(destination.label)
                                    setResults([])
                                    setSearched(false)
                                    setEditing(false)
                                    onSelect(destination)
                                }}
                            >
                                <span aria-hidden="true">📍</span>
                                <span>{destination.label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {/* {selected && (
                <div className="destination-selected" role="status">
                    <p>
                        <strong>Destination:</strong> {selected.label}
                    </p>

                    <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => {
                            cancelSearch()
                            setQuery('')
                            setResults([])
                            setSearched(false)
                            setError('')
                            setLoading(false)
                            onClear()
                        }}
                    >
                        Clear destination
                    </button>
                </div>
            )} */}

            {/* <p className="section-note">
                Search uses Geoapify and OpenStreetMap data.
                Check the full address before selecting.
            </p> */}
        </div>
    )
}