import test from 'node:test'
import assert from 'node:assert/strict'

import {
    assessHazardRouteOrder,
    assessRouteLocation,
    assessRouteProximity,
    distanceToRouteMetres,
    projectRouteProgress,
} from '../src/utils/routeHazards.ts'

function geometry(lines) {
    return {
        type: 'MultiLineString',
        coordinates: lines,
    }
}

const straightRoute = geometry([
    [[0, 0], [0.01, 0]],
])

function hazard(overrides = {}) {
    return {
        latitude: 0,
        longitude: 0.005,
        status: 'verified',
        repaired_at: null,
        ...overrides,
    }
}

test('A point between route vertices has almost zero distance', () => {
    const distance = distanceToRouteMetres(
        hazard(),
        straightRoute,
    )

    assert.ok(distance < 0.01)
})

test('Distance is measured to the segment, not just its vertices', () => {
    const distance = distanceToRouteMetres(
        hazard({ latitude: 0.001 }),
        straightRoute,
    )

    assert.ok(Math.abs(distance - 111.195) < 0.5)
})

test('A point beyond the route end uses endpoint distance', () => {
    const distance = distanceToRouteMetres(
        hazard({ longitude: 0.011 }),
        straightRoute,
    )

    assert.ok(Math.abs(distance - 111.195) < 0.5)
})

test('Separate lines are not joined across a gap', () => {
    const route = geometry([
        [[0, 0], [0.001, 0]],
        [[0.009, 0], [0.01, 0]],
    ])

    const distance = distanceToRouteMetres(hazard(), route)

    assert.ok(distance > 400)
})

test('Date-line crossing uses the short segment', () => {
    const route = geometry([
        [[179.99, 0], [-179.99, 0]],
    ])

    const distance = distanceToRouteMetres(
        { latitude: 0, longitude: 180 },
        route,
    )

    assert.ok(distance < 0.01)
})

test('Repeated route coordinates are supported', () => {
    const route = geometry([
        [[0, 0], [0, 0], [0.01, 0]],
    ])

    assert.ok(distanceToRouteMetres(hazard(), route) < 0.01)
})

test('Verified unrepaired reports can be near the route', () => {
    const result = assessRouteProximity(
        hazard(),
        straightRoute,
    )

    assert.equal(result.state, 'near')
})

test('Distant reports are classified as far', () => {
    const result = assessRouteProximity(
        hazard({ latitude: 0.01 }),
        straightRoute,
    )

    assert.equal(result.state, 'far')
})

test('Pending, rejected and repaired reports are excluded', () => {
    for (const overrides of [
        { status: 'pending' },
        { status: 'rejected' },
        { repaired_at: '2026-11-26T05:00:00Z' },
        { repaired_at: undefined },
    ]) {
        assert.equal(
            assessRouteProximity(
                hazard(overrides),
                straightRoute,
            ).state,
            'excluded',
        )
    }
})

test('Invalid coordinates or geometry are unavailable, not safe', () => {
    assert.equal(
        assessRouteProximity(
            hazard({ latitude: 91 }),
            straightRoute,
        ).state,
        'unavailable',
    )

    for (const route of [
        geometry([]),
        geometry([[[0, 0]]]),
        geometry([[[0, 0], [181, 0]]]),
    ]) {
        assert.equal(
            assessRouteProximity(hazard(), route).state,
            'unavailable',
        )
    }
})

test('A nearby parallel road can pass the proximity filter', () => {
    const result = assessRouteProximity(
        hazard({ latitude: 0.0002 }),
        straightRoute,
    )

    assert.equal(result.state, 'near')
})

test('Invalid proximity limits are rejected', () => {
    assert.throws(() =>
        assessRouteProximity(hazard(), straightRoute, -1),
    )
})

const now = 1_800_000_000_000

function reading(overrides = {}) {
    return {
        latitude: 0,
        longitude: 0.005,
        timestamp: now - 1000,
        accuracy: 10,
        ...overrides,
    }
}

test('Recent accurate location near the route passes the initial check', () => {
    const result = assessRouteLocation(
        reading(),
        straightRoute,
        now,
        'tracking',
    )

    assert.equal(result.state, 'usable')
})

test('Inactive tracking blocks even a retained recent position', () => {
    const result = assessRouteLocation(
        reading(),
        straightRoute,
        now,
        'stopped',
    )

    assert.deepEqual(result, {
        state: 'blocked',
        reason: 'location_inactive',
    })
})

test('Missing location is blocked', () => {
    assert.equal(
        assessRouteLocation(
            null,
            straightRoute,
            now,
            'tracking',
        ).reason,
        'location_missing',
    )
})

test('Stale and future location readings are blocked', () => {
    for (const timestamp of [now - 15_001, now + 1]) {
        assert.equal(
            assessRouteLocation(
                reading({ timestamp }),
                straightRoute,
                now,
                'tracking',
            ).reason,
            'location_stale',
        )
    }
})

test('Location age and accuracy boundaries are enforced', () => {
    assert.equal(
        assessRouteLocation(
            reading({
                timestamp: now - 15_000,
                accuracy: 25,
            }),
            straightRoute,
            now,
            'tracking',
        ).state,
        'usable',
    )

    assert.equal(
        assessRouteLocation(
            reading({ accuracy: 25.01 }),
            straightRoute,
            now,
            'tracking',
        ).reason,
        'accuracy_insufficient',
    )
})

test('Accurate location away from the route is blocked', () => {
    assert.equal(
        assessRouteLocation(
            reading({ latitude: 0.01 }),
            straightRoute,
            now,
            'tracking',
        ).reason,
        'off_route',
    )
})

test('Invalid location metadata is blocked', () => {
    for (const overrides of [
        { accuracy: -1 },
        { timestamp: Number.NaN },
        { latitude: 91 },
    ]) {
        assert.equal(
            assessRouteLocation(
                reading(overrides),
                straightRoute,
                now,
                'tracking',
            ).reason,
            'invalid_location',
        )
    }
})

test('Invalid route geometry blocks assessment', () => {
    assert.equal(
        assessRouteLocation(
            reading(),
            geometry([]),
            now,
            'tracking',
        ).reason,
        'route_unavailable',
    )
})

test('Progress measures distance from the start of route geometry', () => {
    const result = projectRouteProgress(
        { latitude: 0, longitude: 0.002 },
        straightRoute,
    )

    assert.ok(result)
    assert.ok(Math.abs(result.alongRouteMetres - 222.39) < 0.5)
})

test('A report later in the planned route is classified as later', () => {
    const result = assessHazardRouteOrder(
        reading({ longitude: 0.002 }),
        hazard({ longitude: 0.008 }),
        straightRoute,
        now,
        'tracking',
    )

    assert.equal(result.state, 'later')
    assert.ok(result.separationAlongRouteMetres > 600)
})

test('A report earlier in the planned route is classified as earlier', () => {
    const result = assessHazardRouteOrder(
        reading({ longitude: 0.008 }),
        hazard({ longitude: 0.002 }),
        straightRoute,
        now,
        'tracking',
    )

    assert.equal(result.state, 'earlier')
})

test('Nearby projected positions are uncertain', () => {
    const result = assessHazardRouteOrder(
        reading({ longitude: 0.005 }),
        hazard({ longitude: 0.0051 }),
        straightRoute,
        now,
        'tracking',
    )

    assert.equal(result.state, 'uncertain')
})

test('Poor location accuracy blocks route-order assessment', () => {
    const result = assessHazardRouteOrder(
        reading({ accuracy: 158 }),
        hazard(),
        straightRoute,
        now,
        'tracking',
    )

    assert.equal(result.state, 'blocked')
})

test('Repaired reports are excluded from route-order assessment', () => {
    const result = assessHazardRouteOrder(
        reading(),
        hazard({ repaired_at: '2026-11-26T05:00:00Z' }),
        straightRoute,
        now,
        'tracking',
    )

    assert.equal(result.state, 'excluded')
})

test('Connected route lines preserve cumulative progress', () => {
    const route = geometry([
        [[0, 0], [0.005, 0]],
        [[0.005, 0], [0.01, 0]],
    ])

    const result = projectRouteProgress(
        { latitude: 0, longitude: 0.008 },
        route,
    )

    assert.ok(result)
    assert.ok(Math.abs(result.alongRouteMetres - 889.56) < 0.5)
})

test('A gap between route lines blocks progress projection', () => {
    const route = geometry([
        [[0, 0], [0.001, 0]],
        [[0.009, 0], [0.01, 0]],
    ])

    assert.equal(
        projectRouteProgress(
            { latitude: 0, longitude: 0.0005 },
            route,
        ),
        null,
    )
})

test('Overlapping outbound and return paths are ambiguous', () => {
    const route = geometry([
        [[0, 0], [0.01, 0], [0, 0]],
    ])

    assert.equal(
        projectRouteProgress(
            { latitude: 0, longitude: 0.002 },
            route,
        ),
        null,
    )
})

test('Progress follows route coordinate order', () => {
    const reversedRoute = geometry([
        [[0.01, 0], [0, 0]],
    ])

    const result = assessHazardRouteOrder(
        reading({ longitude: 0.002 }),
        hazard({ longitude: 0.008 }),
        reversedRoute,
        now,
        'tracking',
    )

    assert.equal(result.state, 'earlier')
})

test('Progress supports a route crossing the date line', () => {
    const route = geometry([
        [[179.99, 0], [-179.99, 0]],
    ])

    const result = projectRouteProgress(
        { latitude: 0, longitude: 180 },
        route,
    )

    assert.ok(result)
    assert.ok(Math.abs(result.alongRouteMetres - 1111.95) < 1)
})

test('Off-route points cannot acquire route progress', () => {
    assert.equal(
        projectRouteProgress(
            { latitude: 0.01, longitude: 0.005 },
            straightRoute,
        ),
        null,
    )
})