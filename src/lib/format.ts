/**
 * Time formatting helpers using Intl.DateTimeFormat.
 */

/** Format a UTC Date to a local time string in the given IANA timezone */
export function formatTime(utc: Date, tz: string): string {
  return utc.toLocaleTimeString('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Format a UTC Date to a time string with timezone abbreviation */
export function formatTimeWithTZ(utc: Date, tz: string): string {
  return utc.toLocaleTimeString('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  })
}

/** Format UTC time */
export function formatUTC(utc: Date): string {
  return `${utc.getUTCHours().toString().padStart(2, '0')}:${utc.getUTCMinutes().toString().padStart(2, '0')} UTC`
}

/** Format coordinates */
export function formatCoords(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(1)}°${latDir}, ${Math.abs(lon).toFixed(1)}°${lonDir}`
}

/** Format bearing as compass direction */
export function formatBearing(degrees: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const idx = Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16
  return `${dirs[idx]} (${Math.round(degrees)}°)`
}

/** Format a millisecond countdown as a human-readable string */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now'
  if (ms < 60_000) return '< 1m'
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

/** Format relative direction (positive = right, negative = left) */
export function formatRelativeDirection(degrees: number): string {
  const absDeg = Math.round(Math.abs(degrees))
  if (absDeg < 10) return 'ahead'
  if (absDeg > 170) return 'behind'
  const side = degrees > 0 ? 'right' : 'left'
  return `${absDeg}° to the ${side}`
}
