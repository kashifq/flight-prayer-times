/**
 * Flight path computation: great circle interpolation, altitude profile, horizon dip.
 */

import { sunAltitude } from './solar.ts'
import type { FlightInput, FlightPoint } from './types.ts'

const DEG = Math.PI / 180
const RAD = 180 / Math.PI
const EARTH_RADIUS_M = 6_371_000
const FT_TO_M = 0.3048
const CLIMB_MINUTES = 25
const DESCENT_MINUTES = 30

/** Great circle distance in radians between two points */
export function greatCircleDistanceRad(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const dLat = (lat2 - lat1) * DEG
  const dLon = (lon2 - lon1) * DEG
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Great circle distance in kilometers */
export function greatCircleDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  return greatCircleDistanceRad(lat1, lon1, lat2, lon2) * EARTH_RADIUS_M / 1000
}

/** Spherical interpolation along a great circle arc at fraction f in [0, 1] */
export function interpolateGreatCircle(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  f: number,
): { lat: number; lon: number } {
  const d = greatCircleDistanceRad(lat1, lon1, lat2, lon2)

  if (d < 1e-10) {
    return { lat: lat1, lon: lon1 }
  }

  const sinD = Math.sin(d)
  const A = Math.sin((1 - f) * d) / sinD
  const B = Math.sin(f * d) / sinD

  const lat1Rad = lat1 * DEG
  const lon1Rad = lon1 * DEG
  const lat2Rad = lat2 * DEG
  const lon2Rad = lon2 * DEG

  const x = A * Math.cos(lat1Rad) * Math.cos(lon1Rad) + B * Math.cos(lat2Rad) * Math.cos(lon2Rad)
  const y = A * Math.cos(lat1Rad) * Math.sin(lon1Rad) + B * Math.cos(lat2Rad) * Math.sin(lon2Rad)
  const z = A * Math.sin(lat1Rad) + B * Math.sin(lat2Rad)

  return {
    lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD,
    lon: Math.atan2(y, x) * RAD,
  }
}

/** Initial bearing from point 1 to point 2 along the great circle (degrees, 0-360) */
export function initialBearing(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const lat1Rad = lat1 * DEG
  const lat2Rad = lat2 * DEG
  const dLon = (lon2 - lon1) * DEG

  const y = Math.sin(dLon) * Math.cos(lat2Rad)
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon)

  let bearing = Math.atan2(y, x) * RAD
  return (bearing + 360) % 360
}

/**
 * Trapezoidal altitude profile.
 * Returns altitude in meters at a given minute of flight.
 */
export function altitudeAtMinute(
  minute: number,
  totalMinutes: number,
  cruiseAltitudeM: number,
): number {
  if (totalMinutes <= 0) return 0

  const climbEnd = Math.min(CLIMB_MINUTES, totalMinutes / 2)
  const descentStart = Math.max(totalMinutes - DESCENT_MINUTES, totalMinutes / 2)

  if (minute <= 0) return 0
  if (minute >= totalMinutes) return 0

  if (minute < climbEnd) {
    return cruiseAltitudeM * (minute / climbEnd)
  }
  if (minute > descentStart) {
    return cruiseAltitudeM * ((totalMinutes - minute) / (totalMinutes - descentStart))
  }
  return cruiseAltitudeM
}

/**
 * Horizon dip angle in degrees for a given altitude in meters.
 * This is how much further below the geometric horizon the observer can see.
 */
export function horizonDipAngle(altitudeM: number): number {
  if (altitudeM <= 0) return 0
  return Math.acos(EARTH_RADIUS_M / (EARTH_RADIUS_M + altitudeM)) * RAD
}

/**
 * Generate the complete flight path at 1-minute intervals.
 * Each point includes position, altitude, and sun altitude.
 */
export function generateFlightPath(input: FlightInput): FlightPoint[] {
  const totalMs = input.arrivalUTC.getTime() - input.departureUTC.getTime()
  const totalMinutes = Math.round(totalMs / 60000)
  const cruiseAltM = input.cruiseAltitudeFt * FT_TO_M

  const points: FlightPoint[] = []

  for (let m = 0; m <= totalMinutes; m++) {
    const f = totalMinutes > 0 ? m / totalMinutes : 0
    const pos = interpolateGreatCircle(
      input.departure.lat, input.departure.lon,
      input.arrival.lat, input.arrival.lon,
      f,
    )

    const utc = new Date(input.departureUTC.getTime() + m * 60000)
    const altM = altitudeAtMinute(m, totalMinutes, cruiseAltM)
    const sunAlt = sunAltitude(pos.lat, pos.lon, utc)

    points.push({
      minuteIndex: m,
      utc,
      lat: pos.lat,
      lon: pos.lon,
      altitudeM: altM,
      sunAltitudeDeg: sunAlt,
    })
  }

  return points
}

/** Estimate flight duration in minutes from great circle distance at typical ground speed */
export function estimateFlightDurationMinutes(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const distKm = greatCircleDistanceKm(lat1, lon1, lat2, lon2)
  const groundSpeedKmh = 480 * 1.852 // 480 knots in km/h ≈ 889 km/h
  const flightHours = distKm / groundSpeedKmh
  // Add ~30 min for climb/descent/taxi
  return Math.round(flightHours * 60 + 30)
}
