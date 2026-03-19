import type { PrayerResult } from '../engine/types.ts'

export type TemporalStatus = 'past' | 'current' | 'next' | 'upcoming'

export interface PrayerTemporal {
  prayer: PrayerResult
  temporal: TemporalStatus
  /** Milliseconds until this prayer time. Negative means past. Undefined for undetermined prayers. */
  msUntil?: number
}

export function classifyPrayers(prayers: PrayerResult[], now: Date): PrayerTemporal[] {
  const nowMs = now.getTime()

  // Build initial list with ms offsets
  const items: PrayerTemporal[] = prayers.map((p) => {
    if (p.status.kind !== 'during-flight') {
      return { prayer: p, temporal: 'upcoming' as TemporalStatus }
    }
    const ms = p.status.utc.getTime() - nowMs
    return { prayer: p, temporal: 'upcoming' as TemporalStatus, msUntil: ms }
  })

  // Find the last prayer that is in the past (its time has passed)
  let lastPastIdx = -1
  for (let i = 0; i < items.length; i++) {
    if (items[i].msUntil !== undefined && items[i].msUntil! <= 0) {
      lastPastIdx = i
    }
  }

  // Find the first prayer that is in the future
  let firstFutureIdx = -1
  for (let i = 0; i < items.length; i++) {
    if (items[i].msUntil !== undefined && items[i].msUntil! > 0) {
      firstFutureIdx = i
      break
    }
  }

  // Assign statuses
  for (let i = 0; i < items.length; i++) {
    if (items[i].prayer.status.kind !== 'during-flight') continue

    if (i < lastPastIdx) {
      items[i].temporal = 'past'
    } else if (i === lastPastIdx) {
      items[i].temporal = 'current'
    } else if (i === firstFutureIdx) {
      items[i].temporal = 'next'
    }
    // else stays 'upcoming'
  }

  return items
}
