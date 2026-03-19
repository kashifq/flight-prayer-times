import { useState, useEffect, useRef } from 'react'
import type { Airport } from '../engine/types.ts'
import { searchAirports } from '../lib/fuzzy-search.ts'

let airportData: Airport[] | null = null
let loadPromise: Promise<Airport[]> | null = null

async function loadAirports(): Promise<Airport[]> {
  if (airportData) return airportData
  if (!loadPromise) {
    loadPromise = import('../data/airports.json').then(mod => {
      airportData = mod.default as Airport[]
      return airportData
    })
  }
  return loadPromise
}

export function useAirportSearch(query: string) {
  const [results, setResults] = useState<Airport[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!query.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    timerRef.current = setTimeout(async () => {
      const airports = await loadAirports()
      const matches = searchAirports(query, airports)
      setResults(matches)
      setLoading(false)
    }, 150)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  return { results, loading }
}
