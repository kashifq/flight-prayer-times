import type { PrayerName, QiblaInfo } from '../../engine/types.ts'
import { formatBearing, formatRelativeDirection } from '../../lib/format.ts'
import { PRAYER_INFO } from '../../constants/prayers.ts'

interface Props {
  qiblaMap: Map<PrayerName, QiblaInfo>
}

export function QiblaIndicator({ qiblaMap }: Props) {
  // Show Qibla for each in-flight prayer
  const entries = Array.from(qiblaMap.entries())
  if (entries.length === 0) return null

  // Use the first entry as the primary display (they'll be similar for most flights)
  const [, primaryQibla] = entries[0]

  return (
    <div className="bg-white dark:bg-warm-800 rounded-lg border border-warm-200 dark:border-warm-700 p-4">
      <h3 className="text-sm font-semibold text-warm-600 dark:text-warm-300 uppercase tracking-wide mb-3">
        Qibla Direction
      </h3>

      {/* Compass visual */}
      <div className="flex items-center justify-center mb-4">
        <div className="relative w-24 h-24">
          {/* Compass circle */}
          <div className="absolute inset-0 rounded-full border-2 border-warm-300 dark:border-warm-600" />
          {/* Aircraft direction (up) */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 text-xs text-warm-400">N</div>
          {/* Qibla arrow */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ transform: `rotate(${primaryQibla.relativeToCourse}deg)` }}
          >
            <div className="w-0.5 h-10 bg-gold-500 origin-bottom translate-y-[-5px]">
              <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[8px] border-transparent border-b-gold-500 -translate-x-[3.5px] -translate-y-[7px]" />
            </div>
          </div>
          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-teal-600 rounded-full" />
        </div>
      </div>

      {/* Details for each prayer */}
      <div className="space-y-2">
        {entries.map(([prayer, qibla]) => (
          <div key={prayer} className="flex justify-between text-sm">
            <span className="text-warm-600 dark:text-warm-400">
              At {PRAYER_INFO[prayer].english}:
            </span>
            <span className="text-warm-800 dark:text-warm-100">
              {formatBearing(qibla.bearing)} &middot; {formatRelativeDirection(qibla.relativeToCourse)}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-warm-500 mt-3">
        Bearing is absolute (compass). Relative direction is measured from the aircraft nose.
      </p>
    </div>
  )
}
