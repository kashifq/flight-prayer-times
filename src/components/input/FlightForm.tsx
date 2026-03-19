import { useState, useMemo } from 'react'
import type { Airport, FlightInput } from '../../engine/types.ts'
import { estimateFlightDurationMinutes } from '../../engine/index.ts'
import { AirportSearch } from './AirportSearch.tsx'

interface Props {
  onCalculate: (input: FlightInput) => void
  onOpenSettings: () => void
  initialInput?: FlightInput | null
}

function utcToLocal(utc: Date, tz: string): { date: string; time: string } {
  const date = utc.toLocaleDateString('en-CA', { timeZone: tz })
  const time = utc.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
  return { date, time }
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA')
}

function localToUTC(dateStr: string, timeStr: string, tz: string): Date {
  const localStr = `${dateStr}T${timeStr}:00`
  const testDate = new Date(localStr)
  const utcStr = testDate.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr = testDate.toLocaleString('en-US', { timeZone: tz })
  const utcDate = new Date(utcStr)
  const tzDate = new Date(tzStr)
  const offsetMs = utcDate.getTime() - tzDate.getTime()
  return new Date(testDate.getTime() + offsetMs)
}

function addMinutesToDate(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000)
}

function formatEstimate(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `~${h}h ${m}m`
}

const inputClass = `w-full min-w-0 px-3 py-2.5 rounded-lg border border-outline bg-surface text-on-surface
                    focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
                    transition-shadow`

export function FlightForm({ onCalculate, onOpenSettings, initialInput }: Props) {
  const depLocal = initialInput ? utcToLocal(initialInput.departureUTC, initialInput.departure.tz) : null
  const arrLocal = initialInput ? utcToLocal(initialInput.arrivalUTC, initialInput.arrival.tz) : null

  const [departure, setDeparture] = useState<Airport | null>(initialInput?.departure ?? null)
  const [arrival, setArrival] = useState<Airport | null>(initialInput?.arrival ?? null)
  const [depDate, setDepDate] = useState(depLocal?.date ?? todayStr())
  const [depTime, setDepTime] = useState(depLocal?.time ?? '')
  const [arrTime, setArrTime] = useState(arrLocal?.time ?? '')
  const [arrDate, setArrDate] = useState(arrLocal?.date ?? '')

  const estimate = useMemo(() => {
    if (!departure || !arrival) return null
    return estimateFlightDurationMinutes(departure.lat, departure.lon, arrival.lat, arrival.lon)
  }, [departure, arrival])

  const estimatedArrival = useMemo(() => {
    if (!departure || !arrival || !depDate || !depTime || !estimate) return null
    const depUTC = localToUTC(depDate, depTime, departure.tz)
    const arrUTC = addMinutesToDate(depUTC, estimate)
    const arrLocalTime = arrUTC.toLocaleTimeString('en-GB', { timeZone: arrival.tz, hour: '2-digit', minute: '2-digit' })
    const arrLocalDate = arrUTC.toLocaleDateString('en-CA', { timeZone: arrival.tz })
    return { time: arrLocalTime, date: arrLocalDate }
  }, [departure, arrival, depDate, depTime, estimate])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!departure || !arrival || !depDate || !depTime) return

    const effectiveArrDate = arrDate || estimatedArrival?.date || depDate
    const effectiveArrTime = arrTime || estimatedArrival?.time || ''
    if (!effectiveArrTime) return

    const departureUTC = localToUTC(depDate, depTime, departure.tz)
    const arrivalUTC = localToUTC(effectiveArrDate, effectiveArrTime, arrival.tz)

    if (arrivalUTC.getTime() <= departureUTC.getTime()) {
      arrivalUTC.setDate(arrivalUTC.getDate() + 1)
    }

    onCalculate({
      departure,
      arrival,
      departureUTC,
      arrivalUTC,
      cruiseAltitudeFt: 35000,
    })
  }

  const isValid = departure && arrival && depDate && depTime && (arrTime || estimatedArrival)

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-on-surface-variant">Departure</label>
        <AirportSearch value={departure} onChange={setDeparture} />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={depDate} onChange={(e) => setDepDate(e.target.value)} className={inputClass} />
          <input type="time" value={depTime} onChange={(e) => setDepTime(e.target.value)} className={inputClass} />
        </div>
        {departure && (
          <p className="text-xs text-on-surface-variant/60">{departure.tz.split('/').pop()}</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-on-surface-variant">Arrival</label>
        <AirportSearch value={arrival} onChange={setArrival} />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={arrDate || estimatedArrival?.date || ''} onChange={(e) => setArrDate(e.target.value)} className={inputClass} />
          <input
            type="time"
            value={arrTime || estimatedArrival?.time || ''}
            onChange={(e) => setArrTime(e.target.value)}
            className={inputClass}
          />
        </div>
        {arrival && (
          <p className="text-xs text-on-surface-variant/60">{arrival.tz.split('/').pop()}</p>
        )}
        {estimate && (
          <p className="text-xs text-on-surface-variant/60">Est. {formatEstimate(estimate)}</p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={!isValid}
          className="flex-1 py-3 rounded-full bg-primary text-on-primary font-semibold
                     shadow-sm hover:bg-primary-hover active:scale-[0.98]
                     disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Calculate Prayer Times
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="px-4 py-3 rounded-full border border-outline text-on-surface-variant
                     hover:bg-surface-variant hover:border-on-surface-variant/30 transition-colors"
          aria-label="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </form>
  )
}
