import { describe, it, expect } from 'vitest'
import {
  greatCircleDistanceKm,
  interpolateGreatCircle,
  altitudeAtMinute,
  horizonDipAngle,
  generateFlightPath,
  initialBearing,
  estimateFlightDurationMinutes,
} from './flight-path'

describe('Great Circle Distance', () => {
  it('IAD to DUB is approximately 5900 km', () => {
    // IAD: 38.9445°N, 77.4558°W  DUB: 53.4213°N, 6.2701°W
    const d = greatCircleDistanceKm(38.9445, -77.4558, 53.4213, -6.2701)
    expect(d).toBeGreaterThan(5300)
    expect(d).toBeLessThan(5700)
  })

  it('same point returns ~0', () => {
    const d = greatCircleDistanceKm(51.5, -0.1, 51.5, -0.1)
    expect(d).toBeCloseTo(0, 0)
  })

  it('antipodal points ≈ 20000 km', () => {
    const d = greatCircleDistanceKm(0, 0, 0, 180)
    expect(d).toBeGreaterThan(19900)
    expect(d).toBeLessThan(20100)
  })
})

describe('Great Circle Interpolation', () => {
  it('f=0 returns the departure point', () => {
    const p = interpolateGreatCircle(38.9445, -77.4558, 53.4213, -6.2701, 0)
    expect(p.lat).toBeCloseTo(38.9445, 2)
    expect(p.lon).toBeCloseTo(-77.4558, 2)
  })

  it('f=1 returns the arrival point', () => {
    const p = interpolateGreatCircle(38.9445, -77.4558, 53.4213, -6.2701, 1)
    expect(p.lat).toBeCloseTo(53.4213, 2)
    expect(p.lon).toBeCloseTo(-6.2701, 2)
  })

  it('midpoint of IAD-DUB is north of both (great circle goes over north Atlantic)', () => {
    const mid = interpolateGreatCircle(38.9445, -77.4558, 53.4213, -6.2701, 0.5)
    // Midpoint should be roughly 52-55°N, somewhere in the mid-Atlantic
    expect(mid.lat).toBeGreaterThan(50)
    expect(mid.lat).toBeLessThan(58)
    expect(mid.lon).toBeGreaterThan(-50)
    expect(mid.lon).toBeLessThan(-30)
  })
})

describe('Altitude Profile', () => {
  const cruiseM = 10668 // 35000 ft

  it('altitude at minute 0 is 0', () => {
    expect(altitudeAtMinute(0, 420, cruiseM)).toBe(0)
  })

  it('altitude at end is 0', () => {
    expect(altitudeAtMinute(420, 420, cruiseM)).toBe(0)
  })

  it('altitude at minute 25 is cruise altitude', () => {
    expect(altitudeAtMinute(25, 420, cruiseM)).toBeCloseTo(cruiseM, 0)
  })

  it('altitude at minute 12.5 is half cruise (linear climb)', () => {
    expect(altitudeAtMinute(12.5, 420, cruiseM)).toBeCloseTo(cruiseM / 2, 0)
  })

  it('altitude during cruise phase is constant', () => {
    expect(altitudeAtMinute(100, 420, cruiseM)).toBeCloseTo(cruiseM, 0)
    expect(altitudeAtMinute(200, 420, cruiseM)).toBeCloseTo(cruiseM, 0)
    expect(altitudeAtMinute(389, 420, cruiseM)).toBeCloseTo(cruiseM, 0)
  })

  it('altitude during descent decreases linearly', () => {
    // Descent starts at minute 390 (420-30), ends at 420
    // At minute 405 (halfway through descent), should be ~half cruise
    expect(altitudeAtMinute(405, 420, cruiseM)).toBeCloseTo(cruiseM / 2, 0)
  })

  it('handles very short flights by splitting climb/descent', () => {
    // 30 min flight: climb 15 min, descent 15 min
    expect(altitudeAtMinute(15, 30, cruiseM)).toBeCloseTo(cruiseM, 0)
    expect(altitudeAtMinute(7.5, 30, cruiseM)).toBeCloseTo(cruiseM / 2, 0)
  })
})

describe('Horizon Dip Angle', () => {
  it('is ~3.31 degrees at 35000 ft', () => {
    const dip = horizonDipAngle(10668) // 35000 ft in meters
    expect(dip).toBeGreaterThan(3.2)
    expect(dip).toBeLessThan(3.4)
  })

  it('is 0 at ground level', () => {
    expect(horizonDipAngle(0)).toBe(0)
  })

  it('increases with altitude', () => {
    expect(horizonDipAngle(5000)).toBeLessThan(horizonDipAngle(10000))
  })
})

describe('Initial Bearing', () => {
  it('due north is 0 degrees', () => {
    const b = initialBearing(0, 0, 10, 0)
    expect(b).toBeCloseTo(0, 0)
  })

  it('due east is 90 degrees', () => {
    const b = initialBearing(0, 0, 0, 10)
    expect(b).toBeCloseTo(90, 0)
  })

  it('IAD to DUB is roughly northeast (~50-55 degrees)', () => {
    const b = initialBearing(38.9445, -77.4558, 53.4213, -6.2701)
    expect(b).toBeGreaterThan(45)
    expect(b).toBeLessThan(60)
  })
})

describe('Generate Flight Path', () => {
  it('generates correct number of points for IAD-DUB 7h flight', () => {
    const input = {
      departure: { iata: 'IAD', name: '', city: '', country: '', lat: 38.9445, lon: -77.4558, elevation_ft: 313, tz: 'America/New_York' },
      arrival: { iata: 'DUB', name: '', city: '', country: '', lat: 53.4213, lon: -6.2701, elevation_ft: 242, tz: 'Europe/Dublin' },
      departureUTC: new Date(Date.UTC(2025, 2, 19, 22, 5, 0)), // 6:05 PM EDT = 22:05 UTC
      arrivalUTC: new Date(Date.UTC(2025, 2, 20, 5, 5, 0)),    // 7h later
      cruiseAltitudeFt: 35000,
    }
    const path = generateFlightPath(input)
    expect(path.length).toBe(421) // 0 to 420 inclusive
    expect(path[0].lat).toBeCloseTo(38.9445, 1)
    expect(path[420].lat).toBeCloseTo(53.4213, 1)
    expect(path[0].altitudeM).toBe(0)
    expect(path[420].altitudeM).toBe(0)
    // Mid-flight should be at cruise altitude
    expect(path[200].altitudeM).toBeCloseTo(10668, 0)
  })
})

describe('Estimate Flight Duration', () => {
  it('IAD to DUB estimate is roughly 7-8 hours', () => {
    const mins = estimateFlightDurationMinutes(38.9445, -77.4558, 53.4213, -6.2701)
    expect(mins).toBeGreaterThan(380)
    expect(mins).toBeLessThan(480)
  })

  it('DUB to LHR estimate is roughly 1.5 hours', () => {
    const mins = estimateFlightDurationMinutes(53.4213, -6.2701, 51.4700, -0.4543)
    expect(mins).toBeGreaterThanOrEqual(55)
    expect(mins).toBeLessThan(120)
  })
})
