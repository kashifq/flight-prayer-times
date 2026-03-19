/**
 * Prayer time calculation engine.
 *
 * Two modes:
 * 1. Flight scanning: iterate minute-by-minute along the flight path,
 *    detect when the sun crosses prayer-time thresholds.
 * 2. Static city: compute prayer times for a fixed location and date.
 */

import { julianDay, julianCentury, sunDeclination, equationOfTime, hourAngle } from './solar.ts'
import { horizonDipAngle } from './flight-path.ts'
import { getConvention } from './conventions.ts'
import type {
  FlightPoint, PrayerName, PrayerResult, PrayerStatus,
  Convention, AsrSchool, CalculationSettings,
} from './types.ts'

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

/**
 * Compute the Asr threshold angle given the sun's altitude at solar noon
 * and the Asr shadow factor (1 for standard, 2 for Hanafi).
 */
export function asrAngle(noonAltitude: number, school: AsrSchool): number {
  const factor = school === 'hanafi' ? 2 : 1
  const noonZenith = 90 - noonAltitude
  return RAD * Math.atan(1 / (factor + Math.tan(noonZenith * DEG)))
}

/**
 * Detect ALL prayer times along the flight path by scanning for sun altitude
 * threshold crossings at each minute. Returns all prayers found, potentially
 * multiple of the same type for very long flights.
 */
export function detectFlightPrayerTimes(
  flightPath: FlightPoint[],
  settings: CalculationSettings,
): PrayerResult[] {
  const convention = getConvention(settings.convention)
  const useAltitude = settings.observationMethod === 'altitude-adjusted'
  const results: PrayerResult[] = []

  // Find all crossings for each prayer type
  results.push(...findAllFajr(flightPath, convention, useAltitude))
  results.push(...findAllSunrise(flightPath, useAltitude))
  results.push(...findAllDhuhr(flightPath))
  results.push(...findAllAsr(flightPath, settings.asrSchool))
  results.push(...findAllMaghrib(flightPath, convention, useAltitude))
  results.push(...findAllIsha(flightPath, convention, useAltitude))

  // Sort by UTC time
  results.sort((a, b) => {
    const timeA = a.status.kind === 'during-flight' ? a.status.utc.getTime() : 0
    const timeB = b.status.kind === 'during-flight' ? b.status.utc.getTime() : 0
    return timeA - timeB
  })

  return results
}

function pointToStatus(p: FlightPoint): PrayerStatus {
  return {
    kind: 'during-flight',
    utc: p.utc,
    lat: p.lat,
    lon: p.lon,
    altitudeFt: Math.round(p.altitudeM / 0.3048),
  }
}

function getDip(p: FlightPoint, useAltitude: boolean): number {
  return useAltitude ? horizonDipAngle(p.altitudeM) : 0
}

/**
 * Fajr: sun crosses UP through -(fajrAngle + dip) — pre-dawn.
 */
function findAllFajr(path: FlightPoint[], convention: Convention, useAltitude: boolean): PrayerResult[] {
  const results: PrayerResult[] = []
  for (let i = 1; i < path.length; i++) {
    const dip = getDip(path[i], useAltitude)
    const threshold = -(convention.fajrAngle + dip)
    const prevDip = getDip(path[i - 1], useAltitude)
    const prevThreshold = -(convention.fajrAngle + prevDip)

    if (path[i - 1].sunAltitudeDeg < prevThreshold && path[i].sunAltitudeDeg >= threshold) {
      results.push({ prayer: 'fajr', status: pointToStatus(path[i]), altitudeAdjusted: useAltitude })
    }
  }
  return results
}

/**
 * Sunrise: sun crosses UP through -(0.833 + dip).
 */
function findAllSunrise(path: FlightPoint[], useAltitude: boolean): PrayerResult[] {
  const results: PrayerResult[] = []
  const refraction = 0.833
  for (let i = 1; i < path.length; i++) {
    const dip = getDip(path[i], useAltitude)
    const threshold = -(refraction + dip)
    const prevDip = getDip(path[i - 1], useAltitude)
    const prevThreshold = -(refraction + prevDip)

    if (path[i - 1].sunAltitudeDeg < prevThreshold && path[i].sunAltitudeDeg >= threshold) {
      results.push({ prayer: 'sunrise', status: pointToStatus(path[i]), altitudeAdjusted: useAltitude })
    }
  }
  return results
}

/**
 * Dhuhr: sun reaches a local maximum altitude (meridian transit).
 */
function findAllDhuhr(path: FlightPoint[]): PrayerResult[] {
  const results: PrayerResult[] = []
  for (let i = 1; i < path.length - 1; i++) {
    if (
      path[i].sunAltitudeDeg > path[i - 1].sunAltitudeDeg &&
      path[i].sunAltitudeDeg >= path[i + 1].sunAltitudeDeg &&
      path[i].sunAltitudeDeg > 0
    ) {
      // Verify this is a real transit (not just noise) — altitude should be reasonably high
      // and this should be a clear peak (not a flat section)
      const isTransit = path[i].sunAltitudeDeg > 10 &&
        (path[i].sunAltitudeDeg - path[i - 1].sunAltitudeDeg < 0.5 || // near peak, rate slows
         path[i].sunAltitudeDeg - path[i + 1].sunAltitudeDeg < 0.5)

      if (isTransit) {
        // Add 1 minute precaution
        const idx = Math.min(i + 1, path.length - 1)
        results.push({ prayer: 'dhuhr', status: pointToStatus(path[idx]), altitudeAdjusted: false })
        // Skip ahead to avoid detecting the same transit twice
        i += 60
      }
    }
  }
  return results
}

/**
 * Asr: sun altitude drops below the Asr threshold angle (after noon).
 */
function findAllAsr(path: FlightPoint[], school: AsrSchool): PrayerResult[] {
  const results: PrayerResult[] = []

  // Find noon altitude for Asr angle computation
  // For long flights with multiple noons, we compute locally
  let noonAlt = -Infinity
  for (const p of path) {
    if (p.sunAltitudeDeg > noonAlt) noonAlt = p.sunAltitudeDeg
  }
  if (noonAlt <= 0) return results

  const threshold = asrAngle(noonAlt, school)

  let pastNoon = false
  for (let i = 1; i < path.length; i++) {
    if (path[i].sunAltitudeDeg < path[i - 1].sunAltitudeDeg && path[i - 1].sunAltitudeDeg > 0) {
      pastNoon = true
    }
    // Reset pastNoon when sun starts rising again (new day)
    if (path[i].sunAltitudeDeg > path[i - 1].sunAltitudeDeg && path[i - 1].sunAltitudeDeg < 0) {
      pastNoon = false
    }

    if (pastNoon && path[i - 1].sunAltitudeDeg >= threshold && path[i].sunAltitudeDeg < threshold) {
      results.push({ prayer: 'asr', status: pointToStatus(path[i]), altitudeAdjusted: false })
    }
  }
  return results
}

/**
 * Maghrib: sun crosses DOWN through -(maghribAngle + dip).
 */
function findAllMaghrib(path: FlightPoint[], convention: Convention, useAltitude: boolean): PrayerResult[] {
  const results: PrayerResult[] = []
  for (let i = 1; i < path.length; i++) {
    const dip = getDip(path[i], useAltitude)
    const threshold = -(convention.maghribAngle + dip)
    const prevDip = getDip(path[i - 1], useAltitude)
    const prevThreshold = -(convention.maghribAngle + prevDip)

    if (path[i - 1].sunAltitudeDeg >= prevThreshold && path[i].sunAltitudeDeg < threshold) {
      results.push({ prayer: 'maghrib', status: pointToStatus(path[i]), altitudeAdjusted: useAltitude })
    }
  }
  return results
}

/**
 * Isha: sun crosses DOWN through -(ishaAngle + dip).
 * For Umm al-Qura, it's a fixed 90 minutes after Maghrib.
 */
function findAllIsha(path: FlightPoint[], convention: Convention, useAltitude: boolean): PrayerResult[] {
  if (convention.ishaMinutesAfterMaghrib != null) {
    const maghribs = findAllMaghrib(path, convention, useAltitude)
    const results: PrayerResult[] = []
    for (const maghrib of maghribs) {
      if (maghrib.status.kind !== 'during-flight') continue
      const ishaTime = new Date(maghrib.status.utc.getTime() + convention.ishaMinutesAfterMaghrib * 60000)
      const ishaMinute = Math.round((ishaTime.getTime() - path[0].utc.getTime()) / 60000)
      if (ishaMinute >= 0 && ishaMinute < path.length) {
        results.push({ prayer: 'isha', status: pointToStatus(path[ishaMinute]), altitudeAdjusted: useAltitude })
      }
    }
    return results
  }

  const ishaAngle = convention.ishaAngle!
  const results: PrayerResult[] = []
  for (let i = 1; i < path.length; i++) {
    const dip = getDip(path[i], useAltitude)
    const threshold = -(ishaAngle + dip)
    const prevDip = getDip(path[i - 1], useAltitude)
    const prevThreshold = -(ishaAngle + prevDip)

    if (path[i - 1].sunAltitudeDeg >= prevThreshold && path[i].sunAltitudeDeg < threshold) {
      results.push({ prayer: 'isha', status: pointToStatus(path[i]), altitudeAdjusted: useAltitude })
    }
  }
  return results
}

// ─── Static City Prayer Times ──────────────────────────────────────────────

/**
 * Compute prayer times for a fixed location on a given date.
 * Used for departure-city / arrival-city observation methods.
 * Status is set to 'before-departure' as a placeholder — the caller
 * re-tags as needed.
 */
export function computeStaticPrayerTimes(
  lat: number,
  lon: number,
  date: Date,
  settings: CalculationSettings,
): PrayerResult[] {
  const convention = getConvention(settings.convention)
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))

  const jd = julianDay(utcDate)
  const T = julianCentury(jd)
  const dec = sunDeclination(T)
  const eqTime = equationOfTime(T)

  const noonMinutes = 720 - 4 * lon - eqTime

  const results: PrayerResult[] = []

  function haToTime(ha: number, afternoon: boolean): Date {
    const minutes = afternoon
      ? noonMinutes + ha * 4
      : noonMinutes - ha * 4
    const d = new Date(utcDate.getTime())
    d.setUTCMinutes(Math.round(minutes))
    return d
  }

  function makeResult(prayer: PrayerName, utcTime: Date | null, reason: string): PrayerResult {
    if (utcTime) {
      return { prayer, status: { kind: 'before-departure', utc: utcTime }, altitudeAdjusted: false }
    }
    return { prayer, status: { kind: 'undetermined', reason }, altitudeAdjusted: false }
  }

  // Fajr
  const fajrHA = hourAngle(lat, dec, -convention.fajrAngle)
  results.push(makeResult('fajr', fajrHA ? haToTime(fajrHA, false) : null,
    `Fajr (${convention.fajrAngle}°) has no solution at this latitude on this date.`))

  // Sunrise
  const sunriseHA = hourAngle(lat, dec, -0.833)
  results.push(makeResult('sunrise', sunriseHA ? haToTime(sunriseHA, false) : null,
    'Sunrise has no solution at this latitude on this date.'))

  // Dhuhr
  const dhuhrTime = new Date(utcDate.getTime())
  dhuhrTime.setUTCMinutes(Math.round(noonMinutes) + 1)
  results.push({ prayer: 'dhuhr', status: { kind: 'before-departure', utc: dhuhrTime }, altitudeAdjusted: false })

  // Asr
  const noonAlt = 90 - Math.abs(lat - dec)
  if (noonAlt > 0) {
    const asrThreshold = asrAngle(noonAlt, settings.asrSchool)
    const asrHA = hourAngle(lat, dec, asrThreshold)
    results.push(makeResult('asr', asrHA ? haToTime(asrHA, true) : null,
      'Asr has no solution at this latitude on this date.'))
  } else {
    results.push(makeResult('asr', null, 'No daytime at this latitude on this date.'))
  }

  // Maghrib
  const maghribHA = hourAngle(lat, dec, -convention.maghribAngle)
  results.push(makeResult('maghrib', maghribHA ? haToTime(maghribHA, true) : null,
    `Maghrib (${convention.maghribAngle}°) has no solution at this latitude on this date.`))

  // Isha
  if (convention.ishaMinutesAfterMaghrib != null && maghribHA) {
    const maghribTime = haToTime(maghribHA, true)
    const ishaTime = new Date(maghribTime.getTime() + convention.ishaMinutesAfterMaghrib * 60000)
    results.push({ prayer: 'isha', status: { kind: 'before-departure', utc: ishaTime }, altitudeAdjusted: false })
  } else if (convention.ishaAngle != null) {
    const ishaHA = hourAngle(lat, dec, -convention.ishaAngle)
    results.push(makeResult('isha', ishaHA ? haToTime(ishaHA, true) : null,
      `Isha (${convention.ishaAngle}°) has no solution at this latitude on this date. Consider using ISNA (15°) or consult your local scholar.`))
  } else {
    results.push(makeResult('isha', null, 'Isha has no solution at this latitude on this date.'))
  }

  return results
}
