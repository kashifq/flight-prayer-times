import { useState, useRef, useEffect } from 'react'
import type { Airport } from '../../engine/types.ts'
import { useAirportSearch } from '../../hooks/useAirportSearch.ts'

interface Props {
  label: string
  value: Airport | null
  onChange: (airport: Airport) => void
}

export function AirportSearch({ label, value, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const { results } = useAirportSearch(query)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(airport: Airport) {
    onChange(airport)
    setQuery('')
    setOpen(false)
  }

  const displayValue = value ? `${value.iata} — ${value.city}` : ''

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-on-surface-variant mb-1">{label}</label>
      <input
        type="text"
        value={open ? query : displayValue}
        placeholder="Search airport or city..."
        className="w-full px-3 py-2.5 rounded-lg border border-outline bg-surface text-on-surface
                   focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
                   placeholder:text-on-surface-variant/50 transition-shadow"
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-surface rounded-lg shadow-lg border border-outline-variant
                       max-h-60 overflow-y-auto">
          {results.map((airport) => (
            <li key={airport.iata}>
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-primary-light
                           transition-colors cursor-pointer"
                onClick={() => handleSelect(airport)}
              >
                <span className="font-semibold text-accent">{airport.iata}</span>
                <span className="text-on-surface ml-2">{airport.city}, {airport.country}</span>
                <div className="text-xs text-on-surface-variant/70 truncate">{airport.name}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
