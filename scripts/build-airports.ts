/**
 * Airport data pipeline.
 *
 * Downloads OurAirports CSV data, filters to airports with IATA codes,
 * looks up IANA timezones, and writes a compact JSON file.
 *
 * Usage: npx tsx scripts/build-airports.ts
 *
 * Sources:
 * - airports.csv: https://davidmegginson.github.io/ourairports-data/airports.csv
 * - Timezone: derived from tz_database column in OurAirports data (built into the CSV)
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'airports.json')
const AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv'

interface AirportEntry {
  iata: string
  name: string
  city: string
  country: string
  lat: number
  lon: number
  elevation_ft: number
  tz: string
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current)
  return fields
}

async function main() {
  console.log('Downloading airports.csv...')
  const response = await fetch(AIRPORTS_URL)
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
  }
  const csv = await response.text()
  const lines = csv.split('\n')
  const header = parseCSVLine(lines[0])

  // Find column indices
  const cols: Record<string, number> = {}
  for (let i = 0; i < header.length; i++) {
    cols[header[i].trim()] = i
  }

  const required = ['iata_code', 'name', 'municipality', 'iso_country', 'latitude_deg', 'longitude_deg', 'elevation_ft', 'type']
  for (const col of required) {
    if (!(col in cols)) {
      throw new Error(`Missing column: ${col}`)
    }
  }

  // Check if timezone_iana or similar column exists
  const tzCol = header.findIndex(h => {
    const t = h.trim().toLowerCase()
    return t === 'timezone' || t === 'tz' || t === 'timezone_iana'
  })

  // OurAirports doesn't have a direct timezone column in the main CSV.
  // We'll use a longitude-based timezone estimate as a fallback,
  // but ideally we need a mapping. Let's check what columns are available.
  console.log(`Found ${header.length} columns. Looking for timezone data...`)

  // Parse airports
  const airports: AirportEntry[] = []
  const validTypes = new Set(['large_airport', 'medium_airport'])
  let skippedNoIata = 0
  let skippedType = 0
  let skippedNoTz = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const fields = parseCSVLine(line)
    const iata = fields[cols['iata_code']]?.trim()
    const type = fields[cols['type']]?.trim()

    if (!iata || iata === '""' || iata === '') {
      skippedNoIata++
      continue
    }

    if (!validTypes.has(type)) {
      skippedType++
      continue
    }

    const lat = parseFloat(fields[cols['latitude_deg']])
    const lon = parseFloat(fields[cols['longitude_deg']])
    const elevStr = fields[cols['elevation_ft']]?.trim()
    const elevation = elevStr ? parseFloat(elevStr) : 0

    if (isNaN(lat) || isNaN(lon)) continue

    const name = fields[cols['name']]?.trim() || ''
    const city = fields[cols['municipality']]?.trim() || ''
    const country = fields[cols['iso_country']]?.trim() || ''

    // Try to get timezone from the CSV if available
    let tz = ''
    if (tzCol >= 0 && fields[tzCol]) {
      tz = fields[tzCol].trim()
    }

    airports.push({
      iata: iata.replace(/"/g, ''),
      name: name.replace(/"/g, ''),
      city: city.replace(/"/g, ''),
      country: country.replace(/"/g, ''),
      lat: Math.round(lat * 10000) / 10000,
      lon: Math.round(lon * 10000) / 10000,
      elevation_ft: isNaN(elevation) ? 0 : Math.round(elevation),
      tz,
    })
  }

  console.log(`Parsed ${airports.length} airports with IATA codes (skipped ${skippedNoIata} no-IATA, ${skippedType} wrong-type)`)

  // If no timezone data in CSV, we need to fetch timezone mapping
  const missingTz = airports.filter(a => !a.tz || a.tz === '""')
  if (missingTz.length > airports.length * 0.5) {
    console.log('Most airports missing timezone data. Downloading timezone mapping...')
    await addTimezones(airports)
  }

  // Remove duplicates by IATA code (keep first occurrence)
  const seen = new Set<string>()
  const unique: AirportEntry[] = []
  for (const a of airports) {
    if (!seen.has(a.iata)) {
      seen.add(a.iata)
      unique.push(a)
    }
  }

  // Sort by IATA code
  unique.sort((a, b) => a.iata.localeCompare(b.iata))

  // Final filter: must have timezone
  const final = unique.filter(a => a.tz && a.tz !== '' && a.tz !== '""')
  const noTz = unique.length - final.length
  if (noTz > 0) {
    console.log(`Warning: ${noTz} airports have no timezone data and were excluded`)
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(final))
  const sizeMB = (fs.statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(2)
  console.log(`Wrote ${final.length} airports to ${OUTPUT_PATH} (${sizeMB} MB)`)

  // Spot check
  const spotChecks = ['IAD', 'DUB', 'JFK', 'DXB', 'SIN', 'NRT', 'LHR', 'SFO', 'GRU', 'JNB']
  console.log('\nSpot check:')
  for (const code of spotChecks) {
    const a = final.find(x => x.iata === code)
    if (a) {
      console.log(`  ${a.iata} | ${a.city.padEnd(20)} | ${a.lat}, ${a.lon} | ${a.tz}`)
    } else {
      console.log(`  ${code} | NOT FOUND`)
    }
  }
}

async function addTimezones(airports: AirportEntry[]) {
  // Try to download the OurAirports navaids or regions data that might have timezone info
  // Actually, the standard approach is to use a separate timezone dataset.
  // Let's try the airport-timezone npm approach — or use the OurAirports regions.csv which has timezone

  // Download regions.csv for timezone mapping by iso_region
  const REGIONS_URL = 'https://davidmegginson.github.io/ourairports-data/regions.csv'

  // Actually, OurAirports airports.csv does NOT have timezone. But the airport-data
  // from other sources does. Let's use a simple timezone lookup by downloading
  // the timezone data from a known source.

  // Alternative: use the OurAirports airport-frequencies or navaids...
  // Simplest: download a pre-made IATA->timezone mapping.
  // The openflights.org data has timezones.

  console.log('Trying OpenFlights.org for timezone data...')
  try {
    const resp = await fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat')
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.text()
    const tzMap = new Map<string, string>()

    for (const line of data.split('\n')) {
      const fields = parseCSVLine(line)
      if (fields.length >= 12) {
        const iata = fields[4]?.replace(/"/g, '').trim()
        const tz = fields[11]?.replace(/"/g, '').trim()
        if (iata && tz && iata !== '\\N' && tz !== '\\N') {
          tzMap.set(iata, tz)
        }
      }
    }

    console.log(`Loaded ${tzMap.size} IATA->timezone mappings from OpenFlights`)

    let matched = 0
    for (const airport of airports) {
      if (!airport.tz || airport.tz === '' || airport.tz === '""') {
        const tz = tzMap.get(airport.iata)
        if (tz) {
          airport.tz = tz
          matched++
        }
      }
    }
    console.log(`Matched ${matched} airport timezones from OpenFlights`)
  } catch (e) {
    console.error('Failed to fetch OpenFlights data:', e)
    console.log('Falling back to longitude-based timezone estimation...')
    for (const airport of airports) {
      if (!airport.tz || airport.tz === '' || airport.tz === '""') {
        airport.tz = estimateTimezone(airport.lat, airport.lon)
      }
    }
  }
}

function estimateTimezone(lat: number, lon: number): string {
  // Very rough fallback — offset-based timezone
  const offset = Math.round(lon / 15)
  if (offset >= 0) return `Etc/GMT-${offset}`
  return `Etc/GMT+${Math.abs(offset)}`
}

main().catch(console.error)
