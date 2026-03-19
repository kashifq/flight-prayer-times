import { describe, it, expect } from 'vitest'
import { detectFlightPrayerTimes, computeStaticPrayerTimes, asrAngle } from './prayer-times'
import { generateFlightPath } from './flight-path'
import type { FlightInput, CalculationSettings, PrayerResult } from './types'

// Helper airports
const IAD = { iata: 'IAD', name: 'Washington Dulles', city: 'Washington', country: 'US', lat: 38.9445, lon: -77.4558, elevation_ft: 313, tz: 'America/New_York' }
const DUB = { iata: 'DUB', name: 'Dublin Airport', city: 'Dublin', country: 'IE', lat: 53.4213, lon: -6.2701, elevation_ft: 242, tz: 'Europe/Dublin' }
const LHR = { iata: 'LHR', name: 'Heathrow', city: 'London', country: 'GB', lat: 51.4700, lon: -0.4543, elevation_ft: 83, tz: 'Europe/London' }

function findPrayer(results: PrayerResult[], name: string): PrayerResult {
  return results.find(r => r.prayer === name)!
}

describe('Asr Angle', () => {
  it('standard Asr angle at 60° noon altitude', () => {
    // At noon altitude 60°, zenith = 30°, shadow = tan(30°) = 0.577
    // Asr when shadow = 1 + 0.577 = 1.577, angle = atan(1/1.577) ≈ 32.4°
    const angle = asrAngle(60, 'standard')
    expect(angle).toBeGreaterThan(30)
    expect(angle).toBeLessThan(35)
  })

  it('hanafi Asr angle is lower than standard', () => {
    const standard = asrAngle(60, 'standard')
    const hanafi = asrAngle(60, 'hanafi')
    expect(hanafi).toBeLessThan(standard)
  })
})

describe('Static City Prayer Times', () => {
  const settings: CalculationSettings = {
    convention: 'isna',
    asrSchool: 'standard',
    observationMethod: 'departure-city',
  }

  it('computes prayer times for Washington DC on March 19', () => {
    const date = new Date(Date.UTC(2025, 2, 19))
    const results = computeStaticPrayerTimes(IAD.lat, IAD.lon, date, settings)

    expect(results).toHaveLength(6)

    // Fajr should be around 10:30-11:00 UTC (5:30-6:00 AM EDT)
    const fajr = findPrayer(results, 'fajr')
    expect(fajr.status.kind).toBe('before-departure')
    if (fajr.status.kind === 'before-departure') {
      const h = fajr.status.utc.getUTCHours()
      expect(h).toBeGreaterThanOrEqual(10)
      expect(h).toBeLessThanOrEqual(11)
    }

    // Dhuhr should be around 17:08-17:15 UTC (12:08-12:15 PM EDT)
    const dhuhr = findPrayer(results, 'dhuhr')
    expect(dhuhr.status.kind).toBe('before-departure')

    // Maghrib should be around 23:15-23:25 UTC (7:15-7:25 PM EDT)
    const maghrib = findPrayer(results, 'maghrib')
    expect(maghrib.status.kind).toBe('before-departure')
    if (maghrib.status.kind === 'before-departure') {
      const h = maghrib.status.utc.getUTCHours()
      expect(h).toBeGreaterThanOrEqual(23)
      expect(h).toBeLessThanOrEqual(23)
    }
  })

  it('Dublin June 21 with MWL: Fajr and Isha should be undetermined', () => {
    const mwlSettings: CalculationSettings = {
      convention: 'mwl',
      asrSchool: 'standard',
      observationMethod: 'departure-city',
    }
    const date = new Date(Date.UTC(2025, 5, 21))
    const results = computeStaticPrayerTimes(DUB.lat, DUB.lon, date, mwlSettings)

    const fajr = findPrayer(results, 'fajr')
    expect(fajr.status.kind).toBe('undetermined')

    const isha = findPrayer(results, 'isha')
    expect(isha.status.kind).toBe('undetermined')
  })

  it('Dublin June 21 with ISNA (15°): Fajr and Isha are also undetermined (sun only reaches ~-13°)', () => {
    // At 53.4°N, June 21, sun minimum altitude ≈ -13.2°
    // So even ISNA's 15° threshold has no solution
    const date = new Date(Date.UTC(2025, 5, 21))
    const results = computeStaticPrayerTimes(DUB.lat, DUB.lon, date, settings)

    const fajr = findPrayer(results, 'fajr')
    expect(fajr.status.kind).toBe('undetermined')

    const isha = findPrayer(results, 'isha')
    expect(isha.status.kind).toBe('undetermined')
  })

  it('Makkah with Umm al-Qura: Isha is 90 min after Maghrib', () => {
    const uaqSettings: CalculationSettings = {
      convention: 'umm-al-qura',
      asrSchool: 'standard',
      observationMethod: 'departure-city',
    }
    const date = new Date(Date.UTC(2025, 2, 19))
    // Makkah: 21.4225°N, 39.8262°E
    const results = computeStaticPrayerTimes(21.4225, 39.8262, date, uaqSettings)

    const maghrib = findPrayer(results, 'maghrib')
    const isha = findPrayer(results, 'isha')
    expect(maghrib.status.kind).toBe('before-departure')
    expect(isha.status.kind).toBe('before-departure')

    if (maghrib.status.kind === 'before-departure' && isha.status.kind === 'before-departure') {
      const diffMin = (isha.status.utc.getTime() - maghrib.status.utc.getTime()) / 60000
      expect(diffMin).toBe(90)
    }
  })
})

describe('Flight Prayer Time Detection - IAD to DUB March 19', () => {
  // IAD -> DUB, March 19, 6:05 PM EDT departure (22:05 UTC), ~7h flight
  // Arrival ~5:05 AM GMT March 20 (05:05 UTC)
  const input: FlightInput = {
    departure: IAD,
    arrival: DUB,
    departureUTC: new Date(Date.UTC(2025, 2, 19, 22, 5, 0)),
    arrivalUTC: new Date(Date.UTC(2025, 2, 20, 5, 5, 0)),
    cruiseAltitudeFt: 35000,
  }

  it('altitude-adjusted Maghrib occurs ~50-60 min into flight', () => {
    const path = generateFlightPath(input)
    const settings: CalculationSettings = {
      convention: 'isna',
      asrSchool: 'standard',
      observationMethod: 'altitude-adjusted',
    }
    const results = detectFlightPrayerTimes(path, settings)
    const maghrib = findPrayer(results, 'maghrib')

    expect(maghrib.status.kind).toBe('during-flight')
    if (maghrib.status.kind === 'during-flight') {
      const minutesIntoFlight = (maghrib.status.utc.getTime() - input.departureUTC.getTime()) / 60000
      // Spec says ~55 min into flight for altitude-adjusted
      expect(minutesIntoFlight).toBeGreaterThan(40)
      expect(minutesIntoFlight).toBeLessThan(70)
    }
  })

  it('ground-level Maghrib occurs earlier than altitude-adjusted', () => {
    const path = generateFlightPath(input)
    const altSettings: CalculationSettings = {
      convention: 'isna',
      asrSchool: 'standard',
      observationMethod: 'altitude-adjusted',
    }
    const gndSettings: CalculationSettings = {
      convention: 'isna',
      asrSchool: 'standard',
      observationMethod: 'ground-level',
    }
    const altResults = detectFlightPrayerTimes(path, altSettings)
    const gndResults = detectFlightPrayerTimes(path, gndSettings)

    const altMaghrib = findPrayer(altResults, 'maghrib')
    const gndMaghrib = findPrayer(gndResults, 'maghrib')

    expect(altMaghrib.status.kind).toBe('during-flight')
    expect(gndMaghrib.status.kind).toBe('during-flight')

    if (altMaghrib.status.kind === 'during-flight' && gndMaghrib.status.kind === 'during-flight') {
      // Ground-level sunset happens before altitude-adjusted (at altitude, you can still see the sun)
      expect(gndMaghrib.status.utc.getTime()).toBeLessThan(altMaghrib.status.utc.getTime())
      // Difference should be roughly 10-20 minutes (due to ~3.3° dip at cruise)
      const diffMin = (altMaghrib.status.utc.getTime() - gndMaghrib.status.utc.getTime()) / 60000
      expect(diffMin).toBeGreaterThan(5)
      expect(diffMin).toBeLessThan(25)
    }
  })

  it('Isha occurs during the flight', () => {
    const path = generateFlightPath(input)
    const settings: CalculationSettings = {
      convention: 'isna',
      asrSchool: 'standard',
      observationMethod: 'altitude-adjusted',
    }
    const results = detectFlightPrayerTimes(path, settings)
    const isha = findPrayer(results, 'isha')

    expect(isha.status.kind).toBe('during-flight')
    if (isha.status.kind === 'during-flight') {
      // Isha should be after Maghrib
      const maghrib = findPrayer(results, 'maghrib')
      if (maghrib.status.kind === 'during-flight') {
        expect(isha.status.utc.getTime()).toBeGreaterThan(maghrib.status.utc.getTime())
      }
    }
  })
})

describe('Short Flight - DUB to LHR', () => {
  it('no prayer transitions during a 10-11 AM flight', () => {
    // DUB -> LHR, 1h flight, March 19, 10:00 AM GMT departure
    const input: FlightInput = {
      departure: DUB,
      arrival: LHR,
      departureUTC: new Date(Date.UTC(2025, 2, 19, 10, 0, 0)),
      arrivalUTC: new Date(Date.UTC(2025, 2, 19, 11, 0, 0)),
      cruiseAltitudeFt: 35000,
    }
    const path = generateFlightPath(input)
    const settings: CalculationSettings = {
      convention: 'isna',
      asrSchool: 'standard',
      observationMethod: 'altitude-adjusted',
    }
    const results = detectFlightPrayerTimes(path, settings)

    // During a 10-11 AM UTC flight in March, no prayer transitions should occur
    // Now returns empty arrays for prayers not found
    expect(results.filter(r => r.prayer === 'fajr')).toHaveLength(0)
    expect(results.filter(r => r.prayer === 'maghrib')).toHaveLength(0)
    expect(results.filter(r => r.prayer === 'isha')).toHaveLength(0)
  })
})

describe('Overnight Flight - IAD to DUB 5pm-6am', () => {
  const input: FlightInput = {
    departure: IAD,
    arrival: DUB,
    departureUTC: new Date(Date.UTC(2025, 2, 19, 21, 0, 0)), // 5pm EDT = 21:00 UTC
    arrivalUTC: new Date(Date.UTC(2025, 2, 20, 6, 0, 0)),    // 6am GMT = 06:00 UTC
    cruiseAltitudeFt: 35000,
  }

  it('finds Maghrib, Isha, AND Fajr during overnight flight', () => {
    const path = generateFlightPath(input)
    const settings: CalculationSettings = {
      convention: 'karachi',
      asrSchool: 'hanafi',
      observationMethod: 'altitude-adjusted',
    }
    const results = detectFlightPrayerTimes(path, settings)

    const maghribs = results.filter(r => r.prayer === 'maghrib')
    const ishas = results.filter(r => r.prayer === 'isha')
    const fajrs = results.filter(r => r.prayer === 'fajr')

    expect(maghribs.length).toBeGreaterThanOrEqual(1)
    expect(ishas.length).toBeGreaterThanOrEqual(1)
    expect(fajrs.length).toBeGreaterThanOrEqual(1)

    // Verify chronological order: Maghrib < Isha < Fajr
    if (maghribs[0].status.kind === 'during-flight' &&
        ishas[0].status.kind === 'during-flight' &&
        fajrs[0].status.kind === 'during-flight') {
      expect(maghribs[0].status.utc.getTime()).toBeLessThan(ishas[0].status.utc.getTime())
      expect(ishas[0].status.utc.getTime()).toBeLessThan(fajrs[0].status.utc.getTime())
    }
  })

  it('Fajr occurs in the early morning hours UTC', () => {
    const path = generateFlightPath(input)
    const settings: CalculationSettings = {
      convention: 'karachi',
      asrSchool: 'hanafi',
      observationMethod: 'altitude-adjusted',
    }
    const results = detectFlightPrayerTimes(path, settings)
    const fajrs = results.filter(r => r.prayer === 'fajr')

    expect(fajrs.length).toBeGreaterThanOrEqual(1)
    if (fajrs[0].status.kind === 'during-flight') {
      const hour = fajrs[0].status.utc.getUTCHours()
      // Fajr over the Atlantic in March should be roughly 03:00-06:00 UTC
      expect(hour).toBeGreaterThanOrEqual(3)
      expect(hour).toBeLessThanOrEqual(6)
    }
  })
})
