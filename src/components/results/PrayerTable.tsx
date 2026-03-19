import type { PrayerResult, QiblaInfo, PrayerName } from '../../engine/types.ts'
import { formatTime, formatUTC, formatCoords, formatRelativeDirection } from '../../lib/format.ts'
import { PRAYER_INFO } from '../../constants/prayers.ts'

interface Props {
  prayers: PrayerResult[]
  departureTz: string
  arrivalTz: string
  qiblaMap: Map<PrayerName, QiblaInfo>
}

export function PrayerTable({ prayers, departureTz, arrivalTz, qiblaMap }: Props) {
  const duringFlight = prayers.filter(p => p.status.kind === 'during-flight')
  if (duringFlight.length === 0) return null

  const depTzShort = departureTz.split('/').pop()?.replace(/_/g, ' ') || departureTz
  const arrTzShort = arrivalTz.split('/').pop()?.replace(/_/g, ' ') || arrivalTz

  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-outline-variant bg-surface-variant/50 text-on-surface-variant text-xs">
            <th className="text-left py-2.5 px-3 font-semibold">Prayer</th>
            <th className="text-left py-2.5 px-3 font-semibold">{depTzShort}</th>
            <th className="text-left py-2.5 px-3 font-semibold">{arrTzShort}</th>
            <th className="text-left py-2.5 px-3 font-semibold">UTC</th>
            <th className="text-left py-2.5 px-3 font-semibold">Position</th>
            <th className="text-left py-2.5 px-3 font-semibold">Qibla</th>
          </tr>
        </thead>
        <tbody>
          {duringFlight.map((prayer, idx) => {
            if (prayer.status.kind !== 'during-flight') return null
            const info = PRAYER_INFO[prayer.prayer]
            const qibla = qiblaMap.get(prayer.prayer)

            return (
              <tr key={`${prayer.prayer}-${idx}`} className="border-b border-outline-variant last:border-b-0 hover:bg-primary-light/30 transition-colors">
                <td className="py-2.5 px-3 font-semibold text-on-surface">{info.english}</td>
                <td className="py-2.5 px-3 tabular-nums">{formatTime(prayer.status.utc, departureTz)}</td>
                <td className="py-2.5 px-3 tabular-nums">{formatTime(prayer.status.utc, arrivalTz)}</td>
                <td className="py-2.5 px-3 tabular-nums text-on-surface-variant">{formatUTC(prayer.status.utc)}</td>
                <td className="py-2.5 px-3 text-xs text-on-surface-variant">{formatCoords(prayer.status.lat, prayer.status.lon)}</td>
                <td className="py-2.5 px-3 text-xs text-on-surface-variant">{qibla ? formatRelativeDirection(qibla.relativeToCourse) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
