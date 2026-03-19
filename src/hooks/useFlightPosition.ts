import { useState, useMemo, useCallback } from 'react'
import type { FlightInput } from '../engine/types.ts'
import { interpolateGreatCircle } from '../engine/flight-path.ts'

export interface ProjectedPosition {
  lat: number
  lon: number
  /** 0 = at departure, 1 = at arrival */
  fraction: number
}

export interface PositionOverride {
  lat: number
  lon: number
  source: 'gps' | 'manual'
}

/** A known position fix at a specific time — either from GPS or manual tap */
export interface PositionFix {
  lat: number
  lon: number
  at: Date
  source: 'gps' | 'manual'
}

export function useFlightPosition(input: FlightInput, now: Date) {
  const [fix, setFix] = useState<PositionFix | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  // Project current position along the great circle.
  // If we have a fix, project from the fix point toward arrival.
  const projected = useMemo((): ProjectedPosition | null => {
    const depMs = input.departureUTC.getTime()
    const arrMs = input.arrivalUTC.getTime()
    const totalMs = arrMs - depMs
    if (totalMs <= 0) return { lat: input.departure.lat, lon: input.departure.lon, fraction: 0 }

    const nowMs = now.getTime()

    if (fix) {
      const fixMs = fix.at.getTime()
      const fixFraction = Math.max(0, Math.min(1, (fixMs - depMs) / totalMs))
      const nowFraction = Math.max(0, Math.min(1, (nowMs - depMs) / totalMs))

      if (nowMs <= fixMs) {
        return { lat: fix.lat, lon: fix.lon, fraction: fixFraction }
      }

      const remainingFraction = 1 - fixFraction
      if (remainingFraction <= 0) return { lat: input.arrival.lat, lon: input.arrival.lon, fraction: 1 }

      const progressSinceFix = (nowFraction - fixFraction) / remainingFraction
      const f = Math.max(0, Math.min(1, progressSinceFix))

      const pos = interpolateGreatCircle(
        fix.lat, fix.lon,
        input.arrival.lat, input.arrival.lon,
        f,
      )
      return { ...pos, fraction: nowFraction }
    }

    // No fix — pure great circle from departure to arrival
    if (nowMs <= depMs) return { lat: input.departure.lat, lon: input.departure.lon, fraction: 0 }
    if (nowMs >= arrMs) return { lat: input.arrival.lat, lon: input.arrival.lon, fraction: 1 }

    const fraction = (nowMs - depMs) / totalMs
    const pos = interpolateGreatCircle(
      input.departure.lat, input.departure.lon,
      input.arrival.lat, input.arrival.lon,
      fraction,
    )
    return { ...pos, fraction }
  }, [input, now, fix])

  // For map display: show override marker only for manual fixes
  const override = useMemo((): PositionOverride | null => {
    if (fix?.source === 'manual') return { lat: fix.lat, lon: fix.lon, source: 'manual' }
    return null
  }, [fix])

  const requestGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not available')
      return
    }
    setGpsLoading(true)
    setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFix({ lat: pos.coords.latitude, lon: pos.coords.longitude, at: new Date(), source: 'gps' })
        setGpsLoading(false)
      },
      (err) => {
        setGpsError(err.code === 1 ? 'Location permission denied' : 'Could not get location')
        setGpsLoading(false)
      },
      { enableHighAccuracy: false, timeout: 10000 },
    )
  }, [])

  const setManualPosition = useCallback((lat: number, lon: number) => {
    setFix({ lat, lon, at: now, source: 'manual' })
  }, [now])

  const clearManualOverride = useCallback(() => {
    // Only clear if the current fix is manual (preserve GPS fixes)
    setFix(prev => prev?.source === 'manual' ? null : prev)
  }, [])

  return {
    projected,
    override,
    fix,
    gpsLoading,
    gpsError,
    requestGPS,
    setManualPosition,
    clearManualOverride,
  }
}
