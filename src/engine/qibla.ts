/**
 * Qibla direction calculation.
 * Computes bearing to Makkah and direction relative to aircraft heading.
 */

import { initialBearing } from './flight-path.ts'
import type { QiblaInfo } from './types.ts'

const MAKKAH_LAT = 21.4225
const MAKKAH_LON = 39.8262

/** Great circle bearing from observer to Makkah (degrees, 0-360) */
export function qiblaBearing(lat: number, lon: number): number {
  return initialBearing(lat, lon, MAKKAH_LAT, MAKKAH_LON)
}

/**
 * Compute Qibla info at a point along the flight path.
 * @param lat Observer latitude
 * @param lon Observer longitude
 * @param aircraftHeading Current aircraft heading (degrees, 0-360)
 */
export function qiblaInfo(lat: number, lon: number, aircraftHeading: number): QiblaInfo {
  const bearing = qiblaBearing(lat, lon)

  // Relative to aircraft: positive = right, negative = left
  let relative = bearing - aircraftHeading
  // Normalize to -180..180
  while (relative > 180) relative -= 360
  while (relative < -180) relative += 360

  return {
    bearing,
    relativeToCourse: relative,
    aircraftHeading,
  }
}
