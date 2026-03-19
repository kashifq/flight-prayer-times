import type { PrayerName as PrayerNameType } from '../../engine/types.ts'
import { PRAYER_INFO } from '../../constants/prayers.ts'

export function PrayerName({ prayer, className }: { prayer: PrayerNameType; className?: string }) {
  const info = PRAYER_INFO[prayer]
  return (
    <span className={`font-semibold ${className ?? ''}`}>
      {info.english}
      <span className="font-arabic text-on-surface-variant/60 font-normal text-xs ml-1.5">{info.arabic}</span>
    </span>
  )
}
