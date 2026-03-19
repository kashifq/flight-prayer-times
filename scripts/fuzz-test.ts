/**
 * Comprehensive fuzz test for edge cases in the flight prayer times engine.
 * Tests many routes × departure times × seasons to find irregular results.
 */
import { computeFlightPrayerTimes } from '../src/engine/index.ts'
import { estimateFlightDurationMinutes } from '../src/engine/flight-path.ts'
import type { FlightInput, PrayerResult, CalculationSettings } from '../src/engine/types.ts'
import airports from '../src/data/airports.json' with { type: 'json' }

type Airport = typeof airports[number]
function findAirport(iata: string): Airport {
  const a = airports.find(a => a.iata === iata)
  if (!a) throw new Error(`Airport ${iata} not found`)
  return a
}

const settings: CalculationSettings = {
  convention: 'karachi', asrSchool: 'hanafi', observationMethod: 'altitude-adjusted'
}

// Routes covering all edge case categories
const routes: { from: string; to: string; category: string }[] = [
  // Polar Arctic routes
  { from: 'SFO', to: 'LHR', category: 'polar-atlantic' },
  { from: 'JFK', to: 'HKG', category: 'polar-arctic' },
  { from: 'LAX', to: 'DXB', category: 'polar-arctic' },
  { from: 'ORD', to: 'PEK', category: 'polar-arctic' },
  { from: 'YVR', to: 'NRT', category: 'polar-pacific' },
  // High-latitude departures
  { from: 'HEL', to: 'JFK', category: 'high-lat-depart' },
  { from: 'KEF', to: 'JFK', category: 'high-lat-depart' }, // Reykjavik
  { from: 'OSL', to: 'BKK', category: 'high-lat-to-tropics' },
  { from: 'ARN', to: 'SIN', category: 'high-lat-to-tropics' }, // Stockholm
  // Very long haul
  { from: 'LHR', to: 'SYD', category: 'ultra-long' },
  { from: 'SIN', to: 'EWR', category: 'ultra-long' },
  { from: 'DIA', to: 'AKL', category: 'ultra-long' }, // Doha to Auckland
  // Transequatorial
  { from: 'JED', to: 'JNB', category: 'transequatorial' }, // Jeddah to Johannesburg
  { from: 'DXB', to: 'SYD', category: 'transequatorial' },
  // East-west along same latitude
  { from: 'NRT', to: 'JFK', category: 'east-west' }, // Tokyo to NYC
  { from: 'LHR', to: 'LAX', category: 'east-west' },
  // Short high-latitude
  { from: 'HEL', to: 'LHR', category: 'short-high-lat' },
  { from: 'KEF', to: 'OSL', category: 'short-high-lat' },
]

// Dates: solstices + equinoxes + mid-season dates
const dates = [
  { label: 'Mar equinox', date: '2026-03-20' },
  { label: 'Jun solstice', date: '2026-06-21' },
  { label: 'Sep equinox', date: '2026-09-22' },
  { label: 'Dec solstice', date: '2026-12-21' },
  { label: 'May (late spring)', date: '2026-05-15' },
  { label: 'Aug (late summer)', date: '2026-08-10' },
]

// Departure times (UTC hours)
const depHoursUTC = [1, 7, 13, 19]

interface Finding {
  route: string
  category: string
  date: string
  depUTC: string
  maxLat: number
  issue: string
  details: string
  prayers: string[]
  resolution: string
}

const findings: Finding[] = []

function describePrayer(p: PrayerResult): string {
  if (p.status.kind !== 'during-flight') return `${p.prayer}(${p.status.kind})`
  const t = p.status.utc.toISOString().slice(11, 16)
  const est = p.estimated ? ` [${p.estimated}]` : ''
  return `${p.prayer}(${t} ${p.status.lat.toFixed(0)}°N,${p.status.lon.toFixed(0)}°E${est})`
}

let totalScenarios = 0
let totalPrayers = 0

for (const route of routes) {
  const dep = findAirport(route.from) as any
  const arr = findAirport(route.to) as any
  const dur = estimateFlightDurationMinutes(dep.lat, dep.lon, arr.lat, arr.lon)

  for (const dateInfo of dates) {
    for (const depHour of depHoursUTC) {
      totalScenarios++
      const depUTC = new Date(`${dateInfo.date}T${String(depHour).padStart(2, '0')}:00:00Z`)
      const arrUTC = new Date(depUTC.getTime() + dur * 60000)

      const input: FlightInput = {
        departure: dep, arrival: arr, departureUTC: depUTC, arrivalUTC: arrUTC, cruiseAltitudeFt: 35000
      }

      const result = computeFlightPrayerTimes(input, settings)
      const prayers = result.prayers
      totalPrayers += prayers.length

      const maxLat = result.flightPath.length > 0
        ? Math.max(...result.flightPath.map(p => Math.abs(p.lat)))
        : Math.max(Math.abs(dep.lat), Math.abs(arr.lat))

      const routeLabel = `${route.from}→${route.to}`
      const depLabel = depUTC.toISOString().slice(0, 16) + 'Z'
      const prayerDescs = prayers.map(describePrayer)

      // Check for findings

      // 1. Duplicate prayer names
      const names = prayers.filter(p => p.status.kind === 'during-flight').map(p => p.prayer)
      const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))]
      if (dupes.length > 0) {
        for (const dup of dupes) {
          const instances = prayers.filter(p => p.prayer === dup && p.status.kind === 'during-flight')
          const times = instances.map(p => {
            if (p.status.kind !== 'during-flight') return ''
            return `${p.status.utc.toISOString().slice(11, 16)} UTC at ${p.status.lat.toFixed(1)}°N`
          })
          findings.push({
            route: routeLabel, category: route.category, date: dateInfo.label, depUTC: depLabel,
            maxLat, issue: `DUPLICATE ${dup}`,
            details: `Found ${instances.length}x: ${times.join(' and ')}`,
            prayers: prayerDescs,
            resolution: `Label as "${dup} (1st)" / "${dup} (2nd)". Both are physically real transitions.`,
          })
        }
      }

      // 2. Estimated prayers (high-lat fallback triggered)
      const estimated = prayers.filter(p => p.estimated && p.estimated !== 'none')
      for (const e of estimated) {
        const method = e.estimated!
        findings.push({
          route: routeLabel, category: route.category, date: dateInfo.label, depUTC: depLabel,
          maxLat, issue: `ESTIMATED ${e.prayer} (${method})`,
          details: e.status.kind === 'during-flight'
            ? `At ${e.status.lat.toFixed(1)}°N, ${e.status.lon.toFixed(1)}°E — ${e.status.utc.toISOString().slice(11, 16)} UTC`
            : 'Undetermined',
          prayers: prayerDescs,
          resolution: method === 'ground-level-fallback'
            ? `Altitude-adjusted threshold (${settings.convention} angle + 3.3° dip) not reached. Ground-level threshold succeeded.`
            : `Neither altitude-adjusted nor ground-level found a crossing. Used angle-based: (angle/60) × night_duration from nearest maghrib/sunrise.`,
        })
      }

      // 3. Zero prayers on flights > 5 hours
      if (prayers.length === 0 && dur > 300) {
        findings.push({
          route: routeLabel, category: route.category, date: dateInfo.label, depUTC: depLabel,
          maxLat, issue: 'ZERO PRAYERS',
          details: `${(dur / 60).toFixed(1)}h flight with no prayer transitions detected`,
          prayers: prayerDescs,
          resolution: 'Show "No prayer transitions during this flight. Use departure or arrival city times."',
        })
      }

      // 4. Very short night segments (maghrib → sunrise < 60 min)
      const maghribTimes = prayers.filter(p => p.prayer === 'maghrib' && p.status.kind === 'during-flight')
      const sunriseTimes = prayers.filter(p => p.prayer === 'sunrise' && p.status.kind === 'during-flight')
      for (const m of maghribTimes) {
        if (m.status.kind !== 'during-flight') continue
        for (const s of sunriseTimes) {
          if (s.status.kind !== 'during-flight') continue
          const nightMin = (s.status.utc.getTime() - m.status.utc.getTime()) / 60000
          if (nightMin > 0 && nightMin < 120) {
            findings.push({
              route: routeLabel, category: route.category, date: dateInfo.label, depUTC: depLabel,
              maxLat, issue: `SHORT NIGHT (${Math.round(nightMin)}m)`,
              details: `Maghrib at ${m.status.utc.toISOString().slice(11, 16)} to Sunrise at ${s.status.utc.toISOString().slice(11, 16)} = ${Math.round(nightMin)} minutes`,
              prayers: prayerDescs,
              resolution: nightMin < 30
                ? 'Extremely short night — Isha/Fajr compressed. Angle-based estimation should place them within this window.'
                : 'Short night but sufficient for estimated Isha/Fajr.',
            })
          }
        }
      }

      // 5. Suspiciously close prayers (< 15 min apart)
      const flightPrayers = prayers.filter(p => p.status.kind === 'during-flight')
      for (let i = 0; i < flightPrayers.length - 1; i++) {
        const a = flightPrayers[i], b = flightPrayers[i + 1]
        if (a.status.kind !== 'during-flight' || b.status.kind !== 'during-flight') continue
        const gapMin = (b.status.utc.getTime() - a.status.utc.getTime()) / 60000
        if (gapMin > 0 && gapMin < 15) {
          findings.push({
            route: routeLabel, category: route.category, date: dateInfo.label, depUTC: depLabel,
            maxLat, issue: `CLOSE PRAYERS (${Math.round(gapMin)}m gap)`,
            details: `${a.prayer} and ${b.prayer} are only ${Math.round(gapMin)} minutes apart`,
            prayers: prayerDescs,
            resolution: 'Physically correct — at high latitudes or during rapid crossing of terminator. Show both with a note about proximity.',
          })
        }
      }

      // 6. Prayer ordering anomalies (e.g., Isha before Maghrib)
      const expectedOrder = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
      for (let i = 0; i < flightPrayers.length - 1; i++) {
        const a = flightPrayers[i], b = flightPrayers[i + 1]
        const aIdx = expectedOrder.indexOf(a.prayer)
        const bIdx = expectedOrder.indexOf(b.prayer)
        // Only flag if they're from the same "day cycle" (close in time, < 6h)
        if (a.status.kind === 'during-flight' && b.status.kind === 'during-flight') {
          const gapMs = b.status.utc.getTime() - a.status.utc.getTime()
          if (gapMs < 6 * 3600000 && aIdx > bIdx && aIdx >= 0 && bIdx >= 0) {
            findings.push({
              route: routeLabel, category: route.category, date: dateInfo.label, depUTC: depLabel,
              maxLat, issue: `ORDER ANOMALY: ${a.prayer} before ${b.prayer}`,
              details: `${a.prayer} at ${(a.status as any).utc.toISOString().slice(11, 16)} then ${b.prayer} at ${(b.status as any).utc.toISOString().slice(11, 16)}`,
              prayers: prayerDescs,
              resolution: 'Can happen on east-west flights crossing many time zones or crossing terminator multiple times. Show in chronological order as the engine produces them.',
            })
          }
        }
      }

      // 7. Undetermined prayers
      const undetermined = prayers.filter(p => p.status.kind === 'undetermined')
      for (const u of undetermined) {
        findings.push({
          route: routeLabel, category: route.category, date: dateInfo.label, depUTC: depLabel,
          maxLat, issue: `UNDETERMINED ${u.prayer}`,
          details: u.status.kind === 'undetermined' ? u.status.reason : '',
          prayers: prayerDescs,
          resolution: 'Show with error styling and the reason text.',
        })
      }
    }
  }
}

// Deduplicate similar findings (same route + issue type)
const uniqueFindings = new Map<string, Finding>()
for (const f of findings) {
  const key = `${f.route}|${f.issue.split('(')[0].trim()}|${f.date}`
  if (!uniqueFindings.has(key)) {
    uniqueFindings.set(key, f)
  }
}

// Print report
console.log('='.repeat(100))
console.log('FLIGHT PRAYER TIMES — COMPREHENSIVE FUZZ TEST REPORT')
console.log(`${totalScenarios} scenarios tested, ${totalPrayers} total prayers computed`)
console.log(`${findings.length} raw findings, ${uniqueFindings.size} unique findings`)
console.log('='.repeat(100))

// Group by issue type
const byIssue = new Map<string, Finding[]>()
for (const f of uniqueFindings.values()) {
  const type = f.issue.split(' ')[0]
  if (!byIssue.has(type)) byIssue.set(type, [])
  byIssue.get(type)!.push(f)
}

for (const [issueType, items] of byIssue) {
  console.log(`\n${'#'.repeat(100)}`)
  console.log(`## ${issueType} (${items.length} cases)`)
  console.log('#'.repeat(100))

  for (const f of items) {
    console.log(`\n  Route: ${f.route} (${f.category})`)
    console.log(`  Date: ${f.date} | Depart: ${f.depUTC} | Max latitude: ${f.maxLat.toFixed(1)}°`)
    console.log(`  Issue: ${f.issue}`)
    console.log(`  Details: ${f.details}`)
    console.log(`  All prayers: ${f.prayers.join(', ')}`)
    console.log(`  Resolution: ${f.resolution}`)
  }
}

console.log(`\n${'='.repeat(100)}`)
console.log('END OF REPORT')
console.log('='.repeat(100))
