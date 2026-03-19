import { useState, useCallback } from 'react'
import type { CalculationSettings, ConventionId, AsrSchool, ObservationMethod } from '../engine/types.ts'

const STORAGE_KEY = 'flight-prayer-settings'

const DEFAULTS: CalculationSettings = {
  convention: 'karachi',
  asrSchool: 'hanafi',
  observationMethod: 'altitude-adjusted',
}

function load(): CalculationSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...DEFAULTS, ...parsed }
    }
  } catch { /* ignore */ }
  return DEFAULTS
}

function save(settings: CalculationSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch { /* ignore */ }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<CalculationSettings>(load)

  const setSettings = useCallback((update: Partial<CalculationSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...update }
      save(next)
      return next
    })
  }, [])

  const setConvention = useCallback((convention: ConventionId) => setSettings({ convention }), [setSettings])
  const setAsrSchool = useCallback((asrSchool: AsrSchool) => setSettings({ asrSchool }), [setSettings])
  const setObservationMethod = useCallback((observationMethod: ObservationMethod) => setSettings({ observationMethod }), [setSettings])

  return { settings, setConvention, setAsrSchool, setObservationMethod }
}
