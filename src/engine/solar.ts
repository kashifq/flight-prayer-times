/**
 * NOAA Solar Position Algorithm (simplified)
 *
 * Computes sun altitude for any (latitude, longitude, UTC time) triple.
 * Accuracy: ~1 minute for sunrise/sunset times.
 *
 * Reference: NOAA Solar Calculator spreadsheet
 * https://gml.noaa.gov/grad/solcalc/
 */

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

/** Convert a Date to Julian Day Number */
export function julianDay(date: Date): number {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  const h = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600

  let yr = y
  let mo = m
  if (mo <= 2) {
    yr -= 1
    mo += 12
  }

  const A = Math.floor(yr / 100)
  const B = 2 - A + Math.floor(A / 4)

  return Math.floor(365.25 * (yr + 4716)) + Math.floor(30.6001 * (mo + 1)) + d + h / 24 + B - 1524.5
}

/** Julian centuries since J2000.0 */
export function julianCentury(jd: number): number {
  return (jd - 2451545.0) / 36525.0
}

/** Sun's geometric mean longitude (degrees) */
export function sunMeanLongitude(T: number): number {
  let L0 = 280.46646 + T * (36000.76983 + T * 0.0003032)
  L0 = L0 % 360
  if (L0 < 0) L0 += 360
  return L0
}

/** Sun's mean anomaly (degrees) */
export function sunMeanAnomaly(T: number): number {
  return 357.52911 + T * (35999.05029 - T * 0.0001537)
}

/** Sun's equation of center (degrees) */
export function sunEquationOfCenter(T: number): number {
  const M = sunMeanAnomaly(T) * DEG
  return (
    Math.sin(M) * (1.914602 - T * (0.004817 + T * 0.000014)) +
    Math.sin(2 * M) * (0.019993 - T * 0.000101) +
    Math.sin(3 * M) * 0.000289
  )
}

/** Sun's true longitude (degrees) */
export function sunTrueLongitude(T: number): number {
  return sunMeanLongitude(T) + sunEquationOfCenter(T)
}

/** Sun's apparent longitude (degrees) */
export function sunApparentLongitude(T: number): number {
  const omega = 125.04 - 1934.136 * T
  return sunTrueLongitude(T) - 0.00569 - 0.00478 * Math.sin(omega * DEG)
}

/** Mean obliquity of the ecliptic (degrees) */
export function meanObliquity(T: number): number {
  return 23.0 + (26.0 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60.0) / 60.0
}

/** Corrected obliquity (degrees) */
export function obliquityCorrection(T: number): number {
  const omega = 125.04 - 1934.136 * T
  return meanObliquity(T) + 0.00256 * Math.cos(omega * DEG)
}

/** Sun's declination (degrees) */
export function sunDeclination(T: number): number {
  const e = obliquityCorrection(T) * DEG
  const lambda = sunApparentLongitude(T) * DEG
  return Math.asin(Math.sin(e) * Math.sin(lambda)) * RAD
}

/** Equation of time (minutes) */
export function equationOfTime(T: number): number {
  const e = obliquityCorrection(T) * DEG
  const L0 = sunMeanLongitude(T) * DEG
  const M = sunMeanAnomaly(T) * DEG
  const eccentricity = 0.016708634 - T * (0.000042037 + T * 0.0000001267)

  let y = Math.tan(e / 2)
  y = y * y

  const eq =
    y * Math.sin(2 * L0) -
    2 * eccentricity * Math.sin(M) +
    4 * eccentricity * y * Math.sin(M) * Math.cos(2 * L0) -
    0.5 * y * y * Math.sin(4 * L0) -
    1.25 * eccentricity * eccentricity * Math.sin(2 * M)

  return 4 * eq * RAD // convert radians to minutes (4 min per degree)
}

/** UTC time of solar noon at a given longitude on a given date */
export function solarNoonUTC(longitude: number, date: Date): Date {
  const jd = julianDay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())))
  const T = julianCentury(jd)
  const eqTime = equationOfTime(T)

  // Solar noon in minutes from midnight UTC
  const noonMinutes = 720 - 4 * longitude - eqTime

  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  result.setUTCMinutes(result.getUTCMinutes() + Math.round(noonMinutes))
  return result
}

/**
 * Compute the sun's altitude angle (degrees above horizon) for a given
 * observer position and UTC time.
 *
 * This is the core function used thousands of times per flight calculation.
 */
export function sunAltitude(lat: number, lon: number, utc: Date): number {
  const jd = julianDay(utc)
  const T = julianCentury(jd)
  const dec = sunDeclination(T) * DEG
  const eqTime = equationOfTime(T)

  // True solar time in minutes
  const utcMinutes = utc.getUTCHours() * 60 + utc.getUTCMinutes() + utc.getUTCSeconds() / 60
  const trueSolarTime = utcMinutes + eqTime + 4 * lon
  // Hour angle in degrees
  let ha = trueSolarTime / 4 - 180
  // Normalize to -180..180
  while (ha > 180) ha -= 360
  while (ha < -180) ha += 360

  const haRad = ha * DEG
  const latRad = lat * DEG

  const sinAlt = Math.sin(latRad) * Math.sin(dec) + Math.cos(latRad) * Math.cos(dec) * Math.cos(haRad)
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) * RAD
}

/**
 * Compute the hour angle (degrees) at which the sun reaches a given altitude
 * for a specific latitude and declination. Returns null if no solution exists
 * (high-latitude edge case: sun never reaches that altitude).
 */
export function hourAngle(lat: number, declination: number, altitude: number): number | null {
  const latRad = lat * DEG
  const decRad = declination * DEG
  const altRad = altitude * DEG

  const cosHA =
    (Math.sin(altRad) - Math.sin(latRad) * Math.sin(decRad)) /
    (Math.cos(latRad) * Math.cos(decRad))

  if (cosHA > 1 || cosHA < -1) return null
  return Math.acos(cosHA) * RAD
}
