import type { PrayerName } from '../engine/types.ts'

export const PRAYER_INFO: Record<PrayerName, { arabic: string; english: string }> = {
  fajr: { arabic: 'الفجر', english: 'Fajr' },
  sunrise: { arabic: 'الشروق', english: 'Sunrise' },
  dhuhr: { arabic: 'الظهر', english: 'Dhuhr' },
  asr: { arabic: 'العصر', english: 'Asr' },
  maghrib: { arabic: 'المغرب', english: 'Maghrib' },
  isha: { arabic: 'العشاء', english: 'Isha' },
}

export const PRAYER_ORDER: PrayerName[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
