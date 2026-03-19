import type { PrayerResult, FlightInput, QiblaInfo, PrayerName as PrayerNameType } from '../../engine/types.ts'
import { PrayerName } from '../shared/PrayerName.tsx'
import { formatTime, formatRelativeDirection, formatCountdown } from '../../lib/format.ts'
import { classifyPrayers } from '../../lib/prayer-status.ts'
import { PRAYER_ORDER } from '../../constants/prayers.ts'
import type { TemporalStatus } from '../../lib/prayer-status.ts'

/** For each prayer, compute an ordinal label if the name appears more than once */
function getOrdinalLabels(prayers: PrayerResult[]): (string | null)[] {
  const counts = new Map<string, number>()
  for (const p of prayers) {
    counts.set(p.prayer, (counts.get(p.prayer) || 0) + 1)
  }
  const seen = new Map<string, number>()
  return prayers.map(p => {
    const total = counts.get(p.prayer) || 1
    if (total <= 1) return null
    const n = (seen.get(p.prayer) || 0) + 1
    seen.set(p.prayer, n)
    return n === 1 ? '1st' : n === 2 ? '2nd' : `${n}th`
  })
}

interface Props {
  prayers: PrayerResult[]
  input: FlightInput
  qiblaMap: Map<PrayerNameType, QiblaInfo>
  now: Date
  onSelectPrayer: (index: number) => void
}

const dotClass: Record<TemporalStatus, string> = {
  past: 'bg-on-surface-variant/30 border-surface',
  current: 'bg-accent border-surface animate-pulse-ring',
  next: 'bg-surface border-primary',
  upcoming: 'bg-surface border-outline',
}

function cardClass(temporal: TemporalStatus, isUndetermined: boolean): string {
  if (isUndetermined) return 'border border-dashed border-error/40 bg-error-light'
  switch (temporal) {
    case 'past':
      return 'bg-surface border border-outline-variant/60 opacity-50'
    case 'current':
      return 'bg-surface border-2 border-accent shadow-md'
    case 'next':
      return 'bg-surface border border-outline-variant shadow-sm'
    default:
      return 'bg-surface border border-outline-variant shadow-sm'
  }
}

export function PrayerTimeline({ prayers, input, qiblaMap, now, onSelectPrayer }: Props) {
  const classified = classifyPrayers(prayers, now)
  const ordinals = getOrdinalLabels(prayers)

  // Find which standard prayers are missing
  const foundPrayers = new Set(prayers.map(p => p.prayer))
  const missingPrayers = PRAYER_ORDER.filter(p => p !== 'sunrise' && !foundPrayers.has(p))

  if (prayers.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-outline-variant p-5 space-y-2">
        <p className="text-on-surface font-medium">No prayer transitions during this flight</p>
        <p className="text-sm text-on-surface-variant">
          All prayer times fall before departure or after arrival. Use your departure or arrival city times instead.
        </p>
      </div>
    )
  }

  return (
    <div className="relative pl-8">
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gradient-to-b from-accent/60 via-primary/40 to-accent/60 rounded-full" />

      <div className="space-y-3">
        {classified.map(({ prayer, temporal, msUntil }, idx) => {
          const qibla = qiblaMap.get(prayer.prayer)
          const isUndetermined = prayer.status.kind === 'undetermined'
          const isDuringFlight = prayer.status.kind === 'during-flight'

          return (
            <div
              key={`${prayer.prayer}-${idx}`}
              className="relative animate-fade-in"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {/* Dot */}
              <div className={`absolute -left-5 top-3.5 w-3 h-3 rounded-full border-2 shadow-sm
                ${isUndetermined ? 'bg-error border-surface' : dotClass[temporal]}`}
              />

              {/* Card */}
              <div
                className={`rounded-xl transition-all ${cardClass(temporal, isUndetermined)}
                  ${isDuringFlight ? 'cursor-pointer active:scale-[0.98]' : ''}`}
                onClick={() => isDuringFlight && onSelectPrayer(idx)}
              >
                <div className="p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PrayerName prayer={prayer.prayer} />
                      {ordinals[idx] && (
                        <span className="text-[10px] font-medium text-on-surface-variant bg-surface-variant px-1.5 py-0.5 rounded">
                          {ordinals[idx]}
                        </span>
                      )}
                      {temporal === 'current' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent-light px-1.5 py-0.5 rounded">
                          Now
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {prayer.status.kind === 'during-flight' && (
                        <span className={`text-sm font-semibold tabular-nums ${temporal === 'past' ? 'text-on-surface-variant' : 'text-primary'}`}>
                          {formatTime(prayer.status.utc, input.departure.tz)}
                        </span>
                      )}
                      {isDuringFlight && (
                        <svg className="w-4 h-4 text-on-surface-variant/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Countdown for "next" prayer */}
                  {temporal === 'next' && msUntil !== undefined && msUntil > 0 && (
                    <div className="mt-1.5">
                      <span className="text-xs font-medium text-primary bg-primary-light px-2 py-0.5 rounded-full">
                        in {formatCountdown(msUntil)}
                      </span>
                    </div>
                  )}

                  {/* Brief qibla hint (current & next only) */}
                  {isDuringFlight && (temporal === 'current' || temporal === 'next') && qibla && (
                    <div className="text-xs text-on-surface-variant mt-1.5 flex items-center gap-1.5">
                      <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                      </svg>
                      Qibla: {formatRelativeDirection(qibla.relativeToCourse)}
                    </div>
                  )}

                  {prayer.status.kind === 'undetermined' && (
                    <p className="text-xs text-error mt-2">{prayer.status.reason}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Missing prayers note */}
      {missingPrayers.length > 0 && (
        <div className="mt-3 text-xs text-on-surface-variant bg-surface-variant rounded-lg px-3 py-2">
          Not during flight: {missingPrayers.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
          — use departure or arrival city times
        </div>
      )}
    </div>
  )
}
