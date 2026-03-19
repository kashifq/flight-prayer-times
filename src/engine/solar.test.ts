import { describe, it, expect } from 'vitest'
import { julianDay, julianCentury, sunDeclination, equationOfTime, sunAltitude, hourAngle, solarNoonUTC } from './solar'

describe('Julian Day', () => {
  it('computes J2000.0 epoch correctly', () => {
    // J2000.0 = January 1, 2000 at 12:00 TT ≈ 12:00 UTC
    const jd = julianDay(new Date(Date.UTC(2000, 0, 1, 12, 0, 0)))
    expect(jd).toBeCloseTo(2451545.0, 1)
  })

  it('computes a known date', () => {
    // March 19, 2025 at 00:00 UTC
    const jd = julianDay(new Date(Date.UTC(2025, 2, 19, 0, 0, 0)))
    expect(jd).toBeCloseTo(2460753.5, 1)
  })
})

describe('Sun Declination', () => {
  it('is near zero at March equinox', () => {
    // March 20, 2025 ~09:00 UTC (approx vernal equinox)
    const jd = julianDay(new Date(Date.UTC(2025, 2, 20, 9, 0, 0)))
    const T = julianCentury(jd)
    const dec = sunDeclination(T)
    expect(Math.abs(dec)).toBeLessThan(0.5) // within 0.5 degrees of 0
  })

  it('is ~23.4 degrees at June solstice', () => {
    // June 21, 2025 ~02:00 UTC
    const jd = julianDay(new Date(Date.UTC(2025, 5, 21, 2, 0, 0)))
    const T = julianCentury(jd)
    const dec = sunDeclination(T)
    expect(dec).toBeGreaterThan(23.0)
    expect(dec).toBeLessThan(23.5)
  })

  it('is ~-23.4 degrees at December solstice', () => {
    // December 21, 2025 ~15:00 UTC
    const jd = julianDay(new Date(Date.UTC(2025, 11, 21, 15, 0, 0)))
    const T = julianCentury(jd)
    const dec = sunDeclination(T)
    expect(dec).toBeLessThan(-23.0)
    expect(dec).toBeGreaterThan(-23.5)
  })
})

describe('Equation of Time', () => {
  it('is near zero at April 15', () => {
    // EqT ≈ 0 around April 15 and June 13
    const jd = julianDay(new Date(Date.UTC(2025, 3, 15, 12, 0, 0)))
    const T = julianCentury(jd)
    const eqt = equationOfTime(T)
    expect(Math.abs(eqt)).toBeLessThan(1.0) // within 1 minute of 0
  })

  it('is ~-14 minutes in mid-February (solar noon is late)', () => {
    const jd = julianDay(new Date(Date.UTC(2025, 1, 12, 12, 0, 0)))
    const T = julianCentury(jd)
    const eqt = equationOfTime(T)
    expect(eqt).toBeLessThan(-12)
    expect(eqt).toBeGreaterThan(-16)
  })

  it('is ~+16 minutes in early November', () => {
    const jd = julianDay(new Date(Date.UTC(2025, 10, 3, 12, 0, 0)))
    const T = julianCentury(jd)
    const eqt = equationOfTime(T)
    expect(eqt).toBeGreaterThan(14)
    expect(eqt).toBeLessThan(18)
  })
})

describe('Sun Altitude', () => {
  it('is high at solar noon at the equator on equinox', () => {
    // March 20, 2025 ~12:00 UTC, at (0, 0) — sun should be near zenith
    const alt = sunAltitude(0, 0, new Date(Date.UTC(2025, 2, 20, 12, 0, 0)))
    expect(alt).toBeGreaterThan(85)
    expect(alt).toBeLessThanOrEqual(90)
  })

  it('is ~48-50 degrees at solar noon in Washington DC on March 19', () => {
    // DC: 38.9°N, -77.0°W
    // Solar noon at -77°W is roughly 12:00 + 77*4min/60 = ~17:08 UTC
    // On March 19, expected noon altitude ≈ 90 - 38.9 - ~0.4 ≈ 50.7
    const alt = sunAltitude(38.9, -77.0, new Date(Date.UTC(2025, 2, 19, 17, 10, 0)))
    expect(alt).toBeGreaterThan(47)
    expect(alt).toBeLessThan(52)
  })

  it('is negative at night', () => {
    // DC at midnight UTC (about 7 PM local, should be setting/set)
    // Actually midnight UTC = 7 PM EDT, sun likely near/below horizon
    // Use 4 AM UTC = 11 PM local, definitely below horizon
    const alt = sunAltitude(38.9, -77.0, new Date(Date.UTC(2025, 2, 19, 4, 0, 0)))
    expect(alt).toBeLessThan(0)
  })

  it('computes Dublin solar noon altitude on June 21 (~60 degrees)', () => {
    // Dublin: 53.4°N
    // June 21 declination ≈ +23.4°, noon altitude ≈ 90 - 53.4 + 23.4 = 60°
    // Solar noon at -6.3°W ≈ 12:00 + 6.3*4/60 ≈ 12:25 UTC
    const alt = sunAltitude(53.4, -6.3, new Date(Date.UTC(2025, 5, 21, 12, 25, 0)))
    expect(alt).toBeGreaterThan(58)
    expect(alt).toBeLessThan(62)
  })
})

describe('Hour Angle', () => {
  it('returns a value for normal conditions', () => {
    // Sunrise/sunset at 40°N, declination 0 (equinox), altitude -0.833
    const ha = hourAngle(40, 0, -0.833)
    expect(ha).not.toBeNull()
    expect(ha!).toBeGreaterThan(89)
    expect(ha!).toBeLessThan(92) // should be close to 90° at equinox
  })

  it('returns null when sun never reaches the angle (polar night)', () => {
    // 70°N, winter declination -23.4, trying to find sunrise (alt=-0.833)
    const ha = hourAngle(70, -23.4, -0.833)
    expect(ha).toBeNull() // sun never rises
  })

  it('returns null when sun never sets (midnight sun)', () => {
    // 70°N, summer declination +23.4, trying to find sunset
    // cosHA = (sin(-0.833) - sin(70)*sin(23.4)) / (cos(70)*cos(23.4))
    // This should be < -1, meaning sun never reaches -0.833° — it never sets
    const ha = hourAngle(70, 23.4, -0.833)
    expect(ha).toBeNull()
  })
})

describe('Solar Noon', () => {
  it('computes solar noon for DC on March 19', () => {
    const noon = solarNoonUTC(-77.0, new Date(Date.UTC(2025, 2, 19)))
    // Should be around 17:08-17:12 UTC
    const hours = noon.getUTCHours() + noon.getUTCMinutes() / 60
    expect(hours).toBeGreaterThan(17.0)
    expect(hours).toBeLessThan(17.3)
  })

  it('computes solar noon for Dublin on June 21', () => {
    const noon = solarNoonUTC(-6.3, new Date(Date.UTC(2025, 5, 21)))
    // Should be around 12:25 UTC (plus EqT adjustment)
    const hours = noon.getUTCHours() + noon.getUTCMinutes() / 60
    expect(hours).toBeGreaterThan(12.2)
    expect(hours).toBeLessThan(12.7)
  })
})
