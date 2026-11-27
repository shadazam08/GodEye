import test from 'node:test'
import assert from 'node:assert/strict'

import {
    selectVoiceAlert,
    canAnnounceVoiceAlert,
    VOICE_ALERT_COOLDOWN_MS,
} from '../src/utils/voiceAlerts.ts'

const now = 1_000_000

function input(overrides = {}) {
    return {
        reading: {
            latitude: 0,
            longitude: 0.001,
            accuracy: 5,
            timestamp: now,
            heading: 90,
            speed: 5,
        },
        geometry: {
            type: 'MultiLineString',
            coordinates: [
                [[0, 0], [0.01, 0]],
            ],
        },
        reports: [
            {
                id: 'report-a',
                latitude: 0,
                longitude: 0.002,
                status: 'verified',
                repaired_at: null,
            },
        ],
        trackingStatus: 'tracking',
        reportsStatus: 'ready',
        visible: true,
        now,
        ...overrides,
    }
}

test('An eligible approaching report can be selected', () => {
    const result = selectVoiceAlert(input())

    assert.equal(result?.id, 'report-a')
    assert.ok(result.distance > 100 && result.distance < 120)
})

test('Hidden, inactive and unavailable report states block alerts', () => {
    const cases = [
        { visible: false },
        { trackingStatus: 'stopped' },
        { reportsStatus: 'loading' },
        { reportsStatus: 'error' },
        { reading: null },
        { geometry: null },
    ]

    for (const overrides of cases) {
        assert.equal(selectVoiceAlert(input(overrides)), null)
    }
})

test('Stale, future and inaccurate readings block alerts', () => {
    for (const changes of [
        { timestamp: now - 60_000 },
        { timestamp: now + 1 },
        { accuracy: 100 },
    ]) {
        const data = input()
        data.reading = { ...data.reading, ...changes }

        assert.equal(selectVoiceAlert(data), null)
    }
})

test('Wrong direction and missing movement metadata block alerts', () => {
    for (const changes of [
        { heading: 270 },
        { heading: null },
        { speed: null },
        { speed: 0 },
    ]) {
        const data = input()
        data.reading = { ...data.reading, ...changes }

        assert.equal(selectVoiceAlert(data), null)
    }
})

test('Pending, rejected and repaired reports never become candidates', () => {
    for (const changes of [
        { status: 'pending' },
        { status: 'rejected' },
        { repaired_at: '2026-11-27T00:00:00Z' },
    ]) {
        const data = input()
        data.reports = [{ ...data.reports[0], ...changes }]

        assert.equal(selectVoiceAlert(data), null)
    }
})

test('Reports earlier in the route or beyond the radius are blocked', () => {
    for (const longitude of [0.0001, 0.005]) {
        const data = input()
        data.reports = [{ ...data.reports[0], longitude }]

        assert.equal(selectVoiceAlert(data), null)
    }
})

test('The nearest eligible report is selected regardless of list order', () => {
    const data = input()

    data.reports = [
        { ...data.reports[0], id: 'further', longitude: 0.0025 },
        { ...data.reports[0], id: 'nearer', longitude: 0.002 },
    ]

    assert.equal(selectVoiceAlert(data)?.id, 'nearer')
})

test('Removing the route clears the selected candidate', () => {
    assert.ok(selectVoiceAlert(input()))
    assert.equal(selectVoiceAlert(input({ geometry: null })), null)
})

test('An announced report is suppressed within the same session', () => {
    const candidate = { id: 'report-a', distance: 100 }

    assert.equal(
        canAnnounceVoiceAlert(
            candidate,
            new Set(['report-a']),
            Number.NEGATIVE_INFINITY,
            now,
        ),
        false,
    )
})

test('Cooldown blocks early announcements and allows its boundary', () => {
    const candidate = { id: 'report-a', distance: 100 }

    assert.equal(
        canAnnounceVoiceAlert(
            candidate,
            new Set(),
            now - VOICE_ALERT_COOLDOWN_MS + 1,
            now,
        ),
        false,
    )

    assert.equal(
        canAnnounceVoiceAlert(
            candidate,
            new Set(),
            now - VOICE_ALERT_COOLDOWN_MS,
            now,
        ),
        true,
    )
})

test('No previous announcement allows the first candidate', () => {
    assert.equal(
        canAnnounceVoiceAlert(
            { id: 'report-a', distance: 100 },
            new Set(),
            Number.NEGATIVE_INFINITY,
            now,
        ),
        true,
    )
})

test('Invalid candidates and timestamps cannot bypass cooldown', () => {
    const candidate = { id: 'report-a', distance: 100 }

    assert.equal(
        canAnnounceVoiceAlert(null, new Set(), 0, now),
        false,
    )

    assert.equal(
        canAnnounceVoiceAlert(
            { ...candidate, distance: Number.NaN },
            new Set(),
            0,
            now,
        ),
        false,
    )

    assert.equal(
        canAnnounceVoiceAlert(candidate, new Set(), now + 1, now),
        false,
    )
})