/**
 * Flight Prayer Times — Public API
 *
 * Main orchestration function that ties together the flight path,
 * prayer time scanning, static city calculations, and qibla direction.
 */

import { generateFlightPath, initialBearing } from './flight-path.ts'
import { detectFlightPrayerTimes, computeStaticPrayerTimes } from './prayer-times.ts'
import { qiblaInfo } from './qibla.ts'
import type {
  FlightInput, CalculationSettings, CalculationResult,
  PrayerName, PrayerResult, FlightPoint, QiblaInfo,
} from './types.ts'

export type { FlightInput, CalculationSettings, CalculationResult, PrayerResult, PrayerName, FlightPoint }
export { computeStaticPrayerTimes } from './prayer-times.ts'
export { generateFlightPath, estimateFlightDurationMinutes } from './flight-path.ts'
export { CONVENTIONS } from './conventions.ts'
export { qiblaBearing, qiblaInfo } from './qibla.ts'

/**
 * Compute prayer times for a flight.
 *
 * Only returns prayers that occur between departure and arrival.
 * For each in-flight prayer, also computes Qibla direction.
 */
export function computeFlightPrayerTimes(
  input: FlightInput,
  settings: CalculationSettings,
): CalculationResult {
  // Static city methods — compute for the relevant city,
  // then filter to only prayers within the flight window
  if (settings.observationMethod === 'departure-city') {
    const prayers = getStaticPrayersInWindow(
      input.departure.lat, input.departure.lon,
      input.departureUTC, input.arrivalUTC, settings,
    )
    return { prayers, flightPath: [], qiblaAtPrayerTimes: new Map(), settings }
  }

  if (settings.observationMethod === 'arrival-city') {
    const prayers = getStaticPrayersInWindow(
      input.arrival.lat, input.arrival.lon,
      input.departureUTC, input.arrivalUTC, settings,
    )
    return { prayers, flightPath: [], qiblaAtPrayerTimes: new Map(), settings }
  }

  // Flight path methods (altitude-adjusted or ground-level)
  const flightPath = generateFlightPath(input)
  const prayers = detectFlightPrayerTimes(flightPath, settings)

  // Only keep prayers that were found during the flight
  const duringFlight = prayers.filter(p => p.status.kind === 'during-flight')

  // Compute Qibla at each in-flight prayer time
  const qiblaAtPrayerTimes = new Map<PrayerName, QiblaInfo>()
  for (const prayer of duringFlight) {
    if (prayer.status.kind === 'during-flight') {
      const minuteIdx = Math.round(
        (prayer.status.utc.getTime() - input.departureUTC.getTime()) / 60000
      )
      if (minuteIdx >= 0 && minuteIdx < flightPath.length) {
        const p = flightPath[minuteIdx]
        const nextIdx = Math.min(minuteIdx + 1, flightPath.length - 1)
        const heading = initialBearing(p.lat, p.lon, flightPath[nextIdx].lat, flightPath[nextIdx].lon)
        qiblaAtPrayerTimes.set(prayer.prayer, qiblaInfo(p.lat, p.lon, heading))
      }
    }
  }

  return {
    prayers: duringFlight,
    flightPath,
    qiblaAtPrayerTimes,
    settings,
  }
}

/**
 * For static city methods: compute prayer times for all dates the flight spans,
 * then filter to only those within the flight window.
 */
function getStaticPrayersInWindow(
  lat: number, lon: number,
  departureUTC: Date, arrivalUTC: Date,
  settings: CalculationSettings,
): PrayerResult[] {
  // Compute static times for each UTC date the flight spans
  const startDate = new Date(Date.UTC(departureUTC.getUTCFullYear(), departureUTC.getUTCMonth(), departureUTC.getUTCDate()))
  const endDate = new Date(Date.UTC(arrivalUTC.getUTCFullYear(), arrivalUTC.getUTCMonth(), arrivalUTC.getUTCDate()))

  const allPrayers: PrayerResult[] = []
  const current = new Date(startDate)

  while (current.getTime() <= endDate.getTime()) {
    const dayPrayers = computeStaticPrayerTimes(lat, lon, current, settings)
    for (const p of dayPrayers) {
      if (p.status.kind !== 'undetermined') {
        const utc = (p.status as { utc: Date }).utc
        if (utc.getTime() >= departureUTC.getTime() && utc.getTime() <= arrivalUTC.getTime()) {
          // Re-tag as during-flight with the city's coords
          allPrayers.push({
            ...p,
            status: {
              kind: 'during-flight',
              utc,
              lat, lon,
              altitudeFt: 0,
            },
          })
        }
      }
    }
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return allPrayers
}
