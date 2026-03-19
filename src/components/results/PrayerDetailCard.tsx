import type { PrayerResult, FlightInput, QiblaInfo, FlightPoint } from '../../engine/types.ts'
import { PrayerName } from '../shared/PrayerName.tsx'
import { formatTime, formatCoords, formatBearing, formatRelativeDirection, formatCountdown } from '../../lib/format.ts'
import { QiblaDiagram } from './QiblaDiagram.tsx'
import { FlightMap } from './FlightMap.tsx'
import type { TemporalStatus } from '../../lib/prayer-status.ts'

interface Props {
  prayer: PrayerResult
  temporal: TemporalStatus
  msUntil?: number
  input: FlightInput
  qibla: QiblaInfo | undefined
  flightPath: FlightPoint[]
  projected: { lat: number; lon: number; fraction: number } | null
  onBack: () => void
}

export function PrayerDetailCard({ prayer, temporal, msUntil, input, qibla, flightPath, projected, onBack }: Props) {
  if (prayer.status.kind !== 'during-flight') return null

  const prayerPos = { lat: prayer.status.lat, lon: prayer.status.lon }

  return (
    <div className="animate-slide-in">
      {/* Header */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-primary mb-4 hover:text-primary-hover transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to timeline
      </button>

      <div className="space-y-5">
        {/* Prayer name + time hero */}
        <div className="bg-surface rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-accent via-primary to-accent" />
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <PrayerName prayer={prayer.prayer} className="text-xl" />
                {temporal === 'current' && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-accent bg-accent-light px-1.5 py-0.5 rounded align-middle">
                    Now
                  </span>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary tabular-nums">
                  {formatTime(prayer.status.utc, input.departure.tz)}
                </div>
                <div className="text-xs text-on-surface-variant">
                  {input.departure.tz.split('/').pop()?.replace(/_/g, ' ')}
                </div>
              </div>
            </div>

            {/* Status chip */}
            {temporal === 'next' && msUntil !== undefined && msUntil > 0 && (
              <div className="mt-3">
                <span className="text-sm font-medium text-primary bg-primary-light px-3 py-1 rounded-full">
                  in {formatCountdown(msUntil)}
                </span>
              </div>
            )}
            {temporal === 'current' && msUntil !== undefined && (
              <div className="mt-3">
                <span className="text-sm font-medium text-accent bg-accent-light px-3 py-1 rounded-full">
                  started {formatCountdown(Math.abs(msUntil))} ago
                </span>
              </div>
            )}
            {temporal === 'past' && (
              <div className="mt-3">
                <span className="text-sm text-on-surface-variant">Completed</span>
              </div>
            )}
          </div>
        </div>

        {/* Times */}
        <div className="bg-surface rounded-xl border border-outline-variant p-4">
          <h3 className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">Times</h3>
          <div className="grid grid-cols-2 gap-3">
            <DetailRow
              label={input.departure.tz.split('/').pop()?.replace(/_/g, ' ') ?? 'Departure'}
              value={formatTime(prayer.status.utc, input.departure.tz)}
            />
            <DetailRow
              label={input.arrival.tz.split('/').pop()?.replace(/_/g, ' ') ?? 'Arrival'}
              value={formatTime(prayer.status.utc, input.arrival.tz)}
            />
          </div>
        </div>

        {/* Qibla direction */}
        {qibla && (
          <div className="bg-surface rounded-xl border border-outline-variant p-4">
            <h3 className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">Qibla Direction</h3>

            <QiblaDiagram qibla={qibla} />

            <div className="grid grid-cols-2 gap-3 mt-3">
              <DetailRow label="Bearing" value={formatBearing(qibla.bearing)} />
              <DetailRow label="Relative to travel" value={formatRelativeDirection(qibla.relativeToCourse)} />
            </div>
          </div>
        )}

        {/* Map showing position at prayer time with day/night */}
        <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
          <div className="p-4 pb-2">
            <h3 className="text-xs font-semibold text-accent uppercase tracking-wider mb-1">Position at Prayer Time</h3>
            <div className="text-sm text-on-surface-variant">{formatCoords(prayer.status.lat, prayer.status.lon)}</div>
          </div>
          <div className="px-2 pb-2">
            <FlightMap
              flightPath={flightPath}
              input={input}
              projected={projected}
              override={null}
              highlightPosition={prayerPos}
              terminatorUtc={prayer.status.utc}
              height={220}
            />
          </div>
          <div className="px-4 pb-3 flex items-center gap-3 text-[10px] text-on-surface-variant">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#22d3ee] inline-block" /> Prayer position
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[rgba(0,0,30,0.5)] inline-block border border-outline-variant" /> Night
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-on-surface-variant/70 leading-tight">{label}</div>
      <div className="text-sm font-medium text-on-surface">{value}</div>
    </div>
  )
}
