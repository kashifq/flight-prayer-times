/**
 * Edge-case flight prayer times test script.
 *
 * Tests 5 routes x 3 dates (summer solstice, winter solstice, equinox) = 15 scenarios.
 * Uses the engine directly to compute prayer times and flags concerning results.
 */

import {
  computeFlightPrayerTimes,
  estimateFlightDurationMinutes,
} from '../src/engine/index.ts'
import type {
  Airport,
  FlightInput,
  CalculationSettings,
  PrayerResult,
} from '../src/engine/types.ts'

// --- Airport data (from airports.json) ---

const SFO: Airport = { iata: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'US', lat: 37.6198, lon: -122.3748, elevation_ft: 13, tz: 'America/Los_Angeles' }
const SIN: Airport = { iata: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'SG', lat: 1.3502, lon: 103.994, elevation_ft: 22, tz: 'Asia/Singapore' }
const JFK: Airport = { iata: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'US', lat: 40.6394, lon: -73.7793, elevation_ft: 13, tz: 'America/New_York' }
const HKG: Airport = { iata: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'HK', lat: 22.3118, lon: 113.9149, elevation_ft: 28, tz: 'Asia/Hong_Kong' }
const LHR: Airport = { iata: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'GB', lat: 51.4707, lon: -0.4599, elevation_ft: 83, tz: 'Europe/London' }
const SYD: Airport = { iata: 'SYD', name: 'Sydney Kingsford Smith International Airport', city: 'Sydney (Mascot)', country: 'AU', lat: -33.9461, lon: 151.177, elevation_ft: 21, tz: 'Australia/Sydney' }
const HEL: Airport = { iata: 'HEL', name: 'Helsinki Vantaa Airport', city: 'Helsinki (Vantaa)', country: 'FI', lat: 60.3184, lon: 24.9633, elevation_ft: 179, tz: 'Europe/Helsinki' }

// --- Route definitions ---

interface Route {
  label: string
  departure: Airport
  arrival: Airport
  /** Departure hour in local time (24h) */
  departureLocalHour: number
  departureLocalMinute: number
}

const routes: Route[] = [
  { label: 'SFO -> SIN (polar Pacific, ~17h)', departure: SFO, arrival: SIN, departureLocalHour: 14, departureLocalMinute: 30 },
  { label: 'JFK -> HKG (polar Arctic, ~16h)', departure: JFK, arrival: HKG, departureLocalHour: 15, departureLocalMinute: 0 },
  { label: 'LHR -> SYD (long haul, ~22h)', departure: LHR, arrival: SYD, departureLocalHour: 21, departureLocalMinute: 0 },
  { label: 'SFO -> LHR (transatlantic, ~10h)', departure: SFO, arrival: LHR, departureLocalHour: 17, departureLocalMinute: 0 },
  { label: 'HEL -> JFK (Helsinki to NY, ~9h)', departure: HEL, arrival: JFK, departureLocalHour: 16, departureLocalMinute: 30 },
]

// --- Dates to test ---

const testDates = [
  { label: 'Summer Solstice', month: 5, day: 21 },  // June 21 (0-indexed month)
  { label: 'Winter Solstice', month: 11, day: 21 },  // Dec 21
  { label: 'Equinox', month: 2, day: 20 },           // March 20
]

// --- Settings ---

const settings: CalculationSettings = {
  convention: 'karachi',
  asrSchool: 'hanafi',
  observationMethod: 'altitude-adjusted',
}

// --- Helper: get UTC departure time from local time ---

function localToUTC(tz: string, year: number, month: number, day: number, hour: number, minute: number): Date {
  // Build an ISO string in the target timezone, then convert to UTC
  // We use a trick: format a date in the target tz to find the offset
  const localStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`

  // Use Intl to get the timezone offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    timeZoneName: 'longOffset',
  })

  // Create a rough UTC date, then adjust
  const roughUTC = new Date(localStr + 'Z')
  const parts = formatter.formatToParts(roughUTC)
  const tzOffset = parts.find(p => p.type === 'timeZoneName')?.value ?? '+00:00'

  // Parse offset like "GMT+08:00" or "GMT-07:00"
  const match = tzOffset.match(/GMT([+-])(\d{2}):(\d{2})/)
  let offsetMinutes = 0
  if (match) {
    const sign = match[1] === '+' ? 1 : -1
    offsetMinutes = sign * (parseInt(match[2]) * 60 + parseInt(match[3]))
  }

  // The local time in UTC is: local - offset
  return new Date(new Date(localStr + 'Z').getTime() - offsetMinutes * 60000)
}

function formatUTC(d: Date): string {
  return d.toISOString().replace('T', ' ').replace('.000Z', ' UTC')
}

// --- Main ---

let totalConcerns = 0

console.log('='.repeat(90))
console.log('FLIGHT PRAYER TIMES — EDGE CASE TEST')
console.log(`Settings: convention=${settings.convention}, asrSchool=${settings.asrSchool}, observation=${settings.observationMethod}`)
console.log('='.repeat(90))

for (const dateInfo of testDates) {
  console.log('')
  console.log('#'.repeat(90))
  console.log(`## ${dateInfo.label} — ${dateInfo.month + 1}/${dateInfo.day}/2026`)
  console.log('#'.repeat(90))

  for (const route of routes) {
    const dep = route.departure
    const arr = route.arrival

    // Estimate flight duration
    const durationMin = estimateFlightDurationMinutes(dep.lat, dep.lon, arr.lat, arr.lon)
    const durationHrs = (durationMin / 60).toFixed(1)

    // Compute departure and arrival in UTC
    const departureUTC = localToUTC(dep.tz, 2026, dateInfo.month, dateInfo.day, route.departureLocalHour, route.departureLocalMinute)
    const arrivalUTC = new Date(departureUTC.getTime() + durationMin * 60000)

    const input: FlightInput = {
      departure: dep,
      arrival: arr,
      departureUTC,
      arrivalUTC,
      cruiseAltitudeFt: 35000,
    }

    console.log('')
    console.log('-'.repeat(80))
    console.log(`  ${route.label}`)
    console.log(`  Estimated duration: ${durationHrs}h (${durationMin} min)`)
    console.log(`  Departure: ${formatUTC(departureUTC)} | Arrival: ${formatUTC(arrivalUTC)}`)
    console.log('-'.repeat(80))

    const result = computeFlightPrayerTimes(input, settings)
    const prayers = result.prayers

    console.log(`  Prayers found: ${prayers.length}`)

    const concerns: string[] = []

    // Print each prayer
    for (const p of prayers) {
      if (p.status.kind === 'during-flight') {
        console.log(`    ${p.prayer.padEnd(10)} during-flight  ${formatUTC(p.status.utc)}  (${p.status.lat.toFixed(2)}, ${p.status.lon.toFixed(2)})  alt-adj=${p.altitudeAdjusted}`)
      } else if (p.status.kind === 'undetermined') {
        console.log(`    ${p.prayer.padEnd(10)} UNDETERMINED   reason: ${p.status.reason}`)
        concerns.push(`UNDETERMINED: ${p.prayer} — ${p.status.reason}`)
      } else {
        console.log(`    ${p.prayer.padEnd(10)} ${p.status.kind}  ${formatUTC(p.status.utc)}`)
      }
    }

    // Check for duplicate prayer names
    const names = prayers.map(p => p.prayer)
    const uniqueNames = new Set(names)
    if (uniqueNames.size < names.length) {
      const dupes = names.filter((n, i) => names.indexOf(n) !== i)
      concerns.push(`DUPLICATE prayer names: ${dupes.join(', ')}`)
    }

    // Check for suspiciously many/few prayers
    // A flight spanning 9-22 hours should typically have 3-8 prayers
    const flightHours = durationMin / 60
    if (prayers.length === 0) {
      concerns.push(`NO prayers found for a ${durationHrs}h flight`)
    } else if (prayers.length > Math.ceil(flightHours / 2) + 2) {
      concerns.push(`Suspiciously MANY prayers (${prayers.length}) for a ${durationHrs}h flight`)
    }

    // Check for undetermined prayers
    const undetermined = prayers.filter(p => p.status.kind === 'undetermined')
    if (undetermined.length > 0) {
      // Already flagged individually above
    }

    if (concerns.length > 0) {
      console.log('')
      console.log(`  *** CONCERNS (${concerns.length}):`)
      for (const c of concerns) {
        console.log(`      ! ${c}`)
      }
      totalConcerns += concerns.length
    }
  }
}

console.log('')
console.log('='.repeat(90))
console.log(`SUMMARY: ${totalConcerns} concern(s) flagged across all ${testDates.length * routes.length} test scenarios.`)
console.log('='.repeat(90))
