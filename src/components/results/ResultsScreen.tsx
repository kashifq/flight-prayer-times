import { useState, useMemo } from 'react'
import type { CalculationResult, FlightInput, CalculationSettings } from '../../engine/types.ts'
import { computeFlightPrayerTimes, CONVENTIONS } from '../../engine/index.ts'
import { formatTimeWithTZ } from '../../lib/format.ts'
import { useNow } from '../../hooks/useNow.ts'
import { useFlightPosition } from '../../hooks/useFlightPosition.ts'
import { classifyPrayers } from '../../lib/prayer-status.ts'
import { PrayerTimeline } from './PrayerTimeline.tsx'
import { PrayerDetailCard } from './PrayerDetailCard.tsx'
import { FlightMap } from './FlightMap.tsx'

interface Props {
  result: CalculationResult
  input: FlightInput
  settings: CalculationSettings
  onBack: () => void
}

export function ResultsScreen({ result: originalResult, input, settings, onBack }: Props) {
  const { now, isDebugTime } = useNow()
  const { projected, override, fix, gpsLoading, gpsError, requestGPS, setManualPosition, clearManualOverride } = useFlightPosition(input, now)
  const [selectedPrayerIdx, setSelectedPrayerIdx] = useState<number | null>(null)
  const [adjustMode, setAdjustMode] = useState(false)

  // When we have a position fix, recalculate prayer times from that point
  const result = useMemo((): CalculationResult => {
    if (!fix) return originalResult

    // Build an adjusted FlightInput: from fix position at fix time → arrival
    const adjustedInput: FlightInput = {
      departure: {
        ...input.departure,
        lat: fix.lat,
        lon: fix.lon,
        // Keep original airport metadata for display
      },
      arrival: input.arrival,
      departureUTC: fix.at,
      arrivalUTC: input.arrivalUTC,
      cruiseAltitudeFt: input.cruiseAltitudeFt,
    }

    // Don't recalculate if fix time is after arrival
    if (fix.at.getTime() >= input.arrivalUTC.getTime()) return originalResult

    return computeFlightPrayerTimes(adjustedInput, settings)
  }, [fix, originalResult, input, settings])

  const convention = CONVENTIONS[result.settings.convention]
  const methodLabels: Record<string, string> = {
    'altitude-adjusted': 'Altitude-adjusted (35,000 ft)',
    'ground-level': 'Ground level at aircraft position',
    'departure-city': `Departure city (${input.departure.iata})`,
    'arrival-city': `Arrival city (${input.arrival.iata})`,
  }

  const duringCount = result.prayers.filter(p => p.status.kind === 'during-flight').length
  const currentPos = override ?? (projected ? { lat: projected.lat, lon: projected.lon } : null)

  const classified = useMemo(() => classifyPrayers(result.prayers, now), [result.prayers, now])

  // Show detail card for selected prayer
  if (selectedPrayerIdx !== null && selectedPrayerIdx < classified.length) {
    const { prayer, temporal, msUntil } = classified[selectedPrayerIdx]
    const qibla = result.qiblaAtPrayerTimes.get(prayer.prayer)

    return (
      <div className="animate-fade-in">
        {isDebugTime && (
          <div className="bg-accent-light text-accent text-xs font-medium text-center py-1.5 px-3 rounded-lg mb-4">
            Debug time: {now.toISOString()}
          </div>
        )}
        <PrayerDetailCard
          prayer={prayer}
          temporal={temporal}
          msUntil={msUntil}
          input={input}
          qibla={qibla}
          flightPath={result.flightPath}
          projected={projected}
          onBack={() => setSelectedPrayerIdx(null)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Debug time banner */}
      {isDebugTime && (
        <div className="bg-accent-light text-accent text-xs font-medium text-center py-1.5 px-3 rounded-lg">
          Debug time: {now.toISOString()}
        </div>
      )}

      {/* Boarding-pass style route card */}
      <div className="bg-surface rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-accent via-primary to-accent" />

        <div className="px-5 pt-4 pb-4">
          {/* Airport codes with flight path */}
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary tracking-wide">{input.departure.iata}</div>
              <div className="text-xs text-on-surface-variant mt-0.5">{input.departure.city}</div>
            </div>

            <div className="flex-1 mx-4 relative flex items-center">
              <div className="w-full border-t border-dashed border-outline" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-surface px-1.5">
                  <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-primary tracking-wide">{input.arrival.iata}</div>
              <div className="text-xs text-on-surface-variant mt-0.5">{input.arrival.city}</div>
            </div>
          </div>

          <div className="flex justify-between mt-3 text-sm text-on-surface-variant">
            <div>{formatTimeWithTZ(input.departureUTC, input.departure.tz)}</div>
            <div>{formatTimeWithTZ(input.arrivalUTC, input.arrival.tz)}</div>
          </div>
        </div>

        {/* Flight map */}
        <div className="px-3 pb-3">
          <FlightMap
            flightPath={result.flightPath}
            input={input}
            projected={projected}
            override={override}
            onTapPosition={adjustMode ? (lat, lon) => { setManualPosition(lat, lon); setAdjustMode(false) } : undefined}
            terminatorUtc={now}
          />

          {/* Adjust mode banner */}
          {adjustMode && (
            <div className="bg-accent-light text-accent text-xs font-medium text-center py-2 px-3 rounded-lg mt-2 flex items-center justify-between">
              <span>Tap the map to set your position</span>
              <button type="button" onClick={() => setAdjustMode(false)} className="underline ml-2">Cancel</button>
            </div>
          )}

          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={requestGPS}
                disabled={gpsLoading}
                className="text-xs font-medium text-primary flex items-center gap-1 hover:text-primary-hover transition-colors disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </svg>
                {gpsLoading ? 'Locating...' : fix?.source === 'gps' ? 'Update GPS' : 'Use GPS'}
              </button>
              {!adjustMode && (
                <button
                  type="button"
                  onClick={() => setAdjustMode(true)}
                  className="text-xs font-medium text-on-surface-variant flex items-center gap-1 hover:text-on-surface transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Adjust
                </button>
              )}
              {override && override.source === 'manual' && (
                <button
                  type="button"
                  onClick={clearManualOverride}
                  className="text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {currentPos && (
              <div className="text-[10px] text-on-surface-variant tabular-nums">
                {Math.abs(currentPos.lat).toFixed(1)}°{currentPos.lat >= 0 ? 'N' : 'S'},{' '}
                {Math.abs(currentPos.lon).toFixed(1)}°{currentPos.lon >= 0 ? 'E' : 'W'}
              </div>
            )}
          </div>
          {gpsError && (
            <div className="text-xs text-error mt-1 px-1">{gpsError}</div>
          )}
          {fix && !adjustMode && (
            <div className="text-[10px] text-on-surface-variant mt-1 px-1 flex items-center gap-1">
              {fix.source === 'gps' ? (
                <>
                  <svg className="w-2.5 h-2.5 text-green-500" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
                  GPS fix — prayer times recalculated from this position
                </>
              ) : (
                <>Position adjusted — prayer times recalculated</>
              )}
            </div>
          )}
        </div>

        {/* Summary strip */}
        <div className="border-t border-dashed border-outline px-5 py-2.5 bg-primary-light/50 flex items-center justify-between text-sm">
          <span className="font-medium text-primary">
            {duringCount} {duringCount === 1 ? 'prayer' : 'prayers'} during flight
          </span>
          {result.prayers.some(p => p.status.kind === 'undetermined') && (
            <span className="text-error text-xs font-medium">Some need attention</span>
          )}
        </div>
      </div>

      {/* Prayer Timeline */}
      <PrayerTimeline
        prayers={result.prayers}
        input={input}
        qiblaMap={result.qiblaAtPrayerTimes}
        now={now}
        onSelectPrayer={setSelectedPrayerIdx}
      />

      {/* Altitude adjustment info */}
      {result.settings.observationMethod === 'altitude-adjusted' && (
        <details className="text-sm text-on-surface-variant bg-surface rounded-xl border border-outline-variant p-4">
          <summary className="cursor-pointer font-medium text-primary">
            What is altitude-adjusted?
          </summary>
          <p className="mt-2">
            At cruising altitude (~35,000 ft), you can see ~3.3° further over Earth's curvature
            than someone on the ground. This means sunset appears later and sunrise appears
            earlier — by roughly 10–20 minutes depending on latitude. The altitude-adjusted
            method accounts for this by modifying the sun depression thresholds used to
            determine prayer times.
          </p>
        </details>
      )}

      {/* Settings summary */}
      <div className="bg-surface-variant rounded-xl px-4 py-3 text-xs text-on-surface-variant">
        <span>{convention.name}</span>
        <span className="mx-1.5 opacity-40">&middot;</span>
        <span>Asr: {result.settings.asrSchool === 'hanafi' ? 'Hanafi' : 'Others'}</span>
        <span className="mx-1.5 opacity-40">&middot;</span>
        <span>{methodLabels[result.settings.observationMethod]}</span>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="w-full py-3 rounded-full border-2 border-primary text-primary font-semibold
                   hover:bg-primary-light active:scale-[0.98] transition-all"
      >
        Edit Flight
      </button>
    </div>
  )
}
