import type { Airport } from '../engine/types.ts'

/**
 * Simple fuzzy search over airports.
 * Priority: exact IATA match > IATA prefix > city substring > name substring
 */
export function searchAirports(query: string, airports: Airport[], limit = 12): Airport[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const scored: { airport: Airport; score: number }[] = []

  for (const airport of airports) {
    const iata = airport.iata.toLowerCase()
    const city = airport.city.toLowerCase()
    const name = airport.name.toLowerCase()
    const country = airport.country.toLowerCase()

    let score = 0

    // Exact IATA match
    if (iata === q) {
      score = 100
    }
    // IATA prefix
    else if (iata.startsWith(q)) {
      score = 80
    }
    // City starts with query
    else if (city.startsWith(q)) {
      score = 60
    }
    // City contains query
    else if (city.includes(q)) {
      score = 40
    }
    // Airport name contains query
    else if (name.includes(q)) {
      score = 30
    }
    // Country code match
    else if (country === q) {
      score = 20
    }
    // Token matching: all query tokens appear somewhere
    else {
      const tokens = q.split(/\s+/)
      const haystack = `${iata} ${city} ${name} ${country}`
      if (tokens.every(t => haystack.includes(t))) {
        score = 15
      }
    }

    if (score > 0) {
      scored.push({ airport, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map(s => s.airport)
}
