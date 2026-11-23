import test from 'node:test'
import assert from 'node:assert/strict'

import {
    distanceInMetres,
    initialBearingDegrees,
    angularDifferenceDegrees,
    assessHazardApproach,
} from '../src/utils/geo.ts'

test('Identical coordinates have zero distance', () => {
    const point = { latitude: 28.6139, longitude: 77.209 }

    assert.equal(distanceInMetres(point, point), 0)
})

test('One longitude degree at the equator is about 111195 metres', () => {
    const distance = distanceInMetres(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
    )

    assert.ok(Math.abs(distance - 111195) < 1)
})

test('Distance is the same in either direction', () => {
    const first = { latitude: 28.6139, longitude: 77.209 }
    const second = { latitude: 28.62, longitude: 77.22 }

    const forward = distanceInMetres(first, second)
    const reverse = distanceInMetres(second, first)

    assert.ok(forward > 0)
    assert.ok(Math.abs(forward - reverse) < 0.000001)
})

test('Nearby points across the date line stay nearby', () => {
    const distance = distanceInMetres(
        { latitude: 0, longitude: 179.999 },
        { latitude: 0, longitude: -179.999 },
    )

    assert.ok(distance > 222 && distance < 223)
})

test('Invalid coordinates are rejected in either argument', () => {
    const valid = { latitude: 0, longitude: 0 }

    const invalidPoints = [
        { latitude: 91, longitude: 0 },
        { latitude: -91, longitude: 0 },
        { latitude: 0, longitude: 181 },
        { latitude: 0, longitude: -181 },
        { latitude: Number.NaN, longitude: 0 },
        { latitude: 0, longitude: Number.POSITIVE_INFINITY },
    ]

    for (const invalid of invalidPoints) {
        assert.throws(
            () => distanceInMetres(invalid, valid),
            /Invalid geographic coordinates/,
        )

        assert.throws(
            () => distanceInMetres(valid, invalid),
            /Invalid geographic coordinates/,
        )
    }
})

test('Cardinal directions have the expected bearings', () => {
    const origin = { latitude: 0, longitude: 0 }

    const cases = [
        [{ latitude: 1, longitude: 0 }, 0],
        [{ latitude: 0, longitude: 1 }, 90],
        [{ latitude: -1, longitude: 0 }, 180],
        [{ latitude: 0, longitude: -1 }, 270],
    ]

    for (const [destination, expected] of cases) {
        const bearing = initialBearingDegrees(origin, destination)

        assert.notEqual(bearing, null)
        assert.ok(
            angularDifferenceDegrees(bearing, expected) < 0.000001,
        )
    }
})

test('Identical points have no unique bearing', () => {
    const point = { latitude: 28.6139, longitude: 77.209 }

    assert.equal(initialBearingDegrees(point, point), null)
})

test('Antipodal points have no unique initial bearing', () => {
    assert.equal(
        initialBearingDegrees(
            { latitude: 0, longitude: 0 },
            { latitude: 0, longitude: 180 },
        ),
        null,
    )
})

test('Bearing crosses the date line in the short direction', () => {
    const bearing = initialBearingDegrees(
        { latitude: 0, longitude: 179 },
        { latitude: 0, longitude: -179 },
    )

    assert.notEqual(bearing, null)
    assert.ok(angularDifferenceDegrees(bearing, 90) < 0.000001)
})

test('Angular difference handles north wraparound', () => {
    assert.equal(angularDifferenceDegrees(359, 1), 2)
    assert.equal(angularDifferenceDegrees(1, 359), 2)
    assert.equal(angularDifferenceDegrees(90, 90), 0)
    assert.equal(angularDifferenceDegrees(0, 180), 180)
})

test('Invalid angles are rejected', () => {
    const invalidAngles = [-1, 360, Number.NaN, Infinity]

    for (const angle of invalidAngles) {
        assert.throws(
            () => angularDifferenceDegrees(angle, 0),
            /Angles must be finite/,
        )

        assert.throws(
            () => angularDifferenceDegrees(0, angle),
            /Angles must be finite/,
        )
    }
})

test('Bearing calculation rejects invalid coordinates', () => {
    const valid = { latitude: 0, longitude: 0 }
    const invalid = { latitude: 91, longitude: 0 }

    assert.throws(
        () => initialBearingDegrees(invalid, valid),
        /Invalid geographic coordinates/,
    )

    assert.throws(
        () => initialBearingDegrees(valid, invalid),
        /Invalid geographic coordinates/,
    )
})

const assessmentTime = 1_700_000_000_000

function makeReading(overrides = {}) {
    return {
        latitude: 0,
        longitude: 0,
        timestamp: assessmentTime,
        accuracy: 10,
        speed: 10,
        heading: 0,
        ...overrides,
    }
}

function makeHazard(overrides = {}) {
    return {
        latitude: 0.001,
        longitude: 0,
        status: 'verified',
        ...overrides,
    }
}

test('Recent accurate reading facing a nearby hazard is a candidate', () => {
    const result = assessHazardApproach(
        makeReading(),
        makeHazard(),
        assessmentTime,
    )

    assert.equal(result.state, 'candidate')
    assert.ok(result.distanceMetres > 111)
    assert.ok(result.distanceMetres < 112)
    assert.equal(result.bearingDegrees, 0)
})

test('Pending and rejected hazards are blocked', () => {
    for (const status of ['pending', 'rejected']) {
        const result = assessHazardApproach(
            makeReading(),
            makeHazard({ status }),
            assessmentTime,
        )

        assert.equal(result.state, 'blocked')
    }
})

test('Invalid coordinates and reading metadata are blocked', () => {
    const invalidReadings = [
        { latitude: 91 },
        { longitude: Number.NaN },
        { timestamp: Number.NaN },
        { accuracy: -1 },
        { accuracy: Infinity },
    ]

    for (const overrides of invalidReadings) {
        assert.equal(
            assessHazardApproach(
                makeReading(overrides),
                makeHazard(),
                assessmentTime,
            ).state,
            'blocked',
        )
    }

    assert.equal(
        assessHazardApproach(
            makeReading(),
            makeHazard({ longitude: 181 }),
            assessmentTime,
        ).state,
        'blocked',
    )

    assert.equal(
        assessHazardApproach(
            makeReading(),
            makeHazard(),
            Number.NaN,
        ).state,
        'blocked',
    )
})

test('Stale and future-dated readings are blocked', () => {
    for (const timestamp of [
        assessmentTime - 15_001,
        assessmentTime + 1,
    ]) {
        assert.equal(
            assessHazardApproach(
                makeReading({ timestamp }),
                makeHazard(),
                assessmentTime,
            ).state,
            'blocked',
        )
    }

    assert.equal(
        assessHazardApproach(
            makeReading({ timestamp: assessmentTime - 15_000 }),
            makeHazard(),
            assessmentTime,
        ).state,
        'candidate',
    )
})

test('Accuracy limit is applied at its boundary', () => {
    assert.equal(
        assessHazardApproach(
            makeReading({ accuracy: 25 }),
            makeHazard(),
            assessmentTime,
        ).state,
        'candidate',
    )

    assert.equal(
        assessHazardApproach(
            makeReading({ accuracy: 25.01 }),
            makeHazard(),
            assessmentTime,
        ).state,
        'blocked',
    )
})

test('Missing and invalid headings are blocked', () => {
    for (const heading of [null, Number.NaN, Infinity, -1, 360]) {
        assert.equal(
            assessHazardApproach(
                makeReading({ heading }),
                makeHazard(),
                assessmentTime,
            ).state,
            'blocked',
        )
    }
})

test('Missing, invalid and insufficient speed readings are blocked', () => {
    for (const speed of [null, Number.NaN, Infinity, -1, 0, 0.5]) {
        assert.equal(
            assessHazardApproach(
                makeReading({ speed }),
                makeHazard(),
                assessmentTime,
            ).state,
            'blocked',
        )
    }

    assert.equal(
        assessHazardApproach(
            makeReading({ speed: 1 }),
            makeHazard(),
            assessmentTime,
        ).state,
        'candidate',
    )
})

test('Far, behind and coincident hazards are blocked', () => {
    const hazards = [
        makeHazard({ latitude: 0.003 }),
        makeHazard({ latitude: -0.001 }),
        makeHazard({ latitude: 0, longitude: 0 }),
    ]

    for (const hazard of hazards) {
        assert.equal(
            assessHazardApproach(
                makeReading(),
                hazard,
                assessmentTime,
            ).state,
            'blocked',
        )
    }
})

test('Approach assessment handles heading wraparound', () => {
    assert.equal(
        assessHazardApproach(
            makeReading({ heading: 359 }),
            makeHazard(),
            assessmentTime,
        ).state,
        'candidate',
    )
})

test('Direction filtering alone cannot exclude a parallel-road location', () => {
    // This coordinate could belong to a separate nearby road.
    // The function has no road-network information to distinguish it.
    const result = assessHazardApproach(
        makeReading(),
        makeHazard({
            latitude: 0.001,
            longitude: 0.0002,
        }),
        assessmentTime,
    )

    assert.equal(result.state, 'candidate')
})