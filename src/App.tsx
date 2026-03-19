import { useState } from 'react'
import type { FlightInput, CalculationResult } from './engine/types.ts'
import { computeFlightPrayerTimes } from './engine/index.ts'
import { useSettings } from './hooks/useSettings.ts'
import { FlightForm } from './components/input/FlightForm.tsx'
import { InstallHint } from './components/shared/InstallHint.tsx'
import { SettingsSheet } from './components/settings/SettingsSheet.tsx'
import { ResultsScreen } from './components/results/ResultsScreen.tsx'

function App() {
  const { settings, setConvention, setAsrSchool, setObservationMethod } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [input, setInput] = useState<FlightInput | null>(null)

  function handleCalculate(flightInput: FlightInput) {
    const calcResult = computeFlightPrayerTimes(flightInput, settings)
    setInput(flightInput)
    setResult(calcResult)
  }

  function handleBack() {
    setResult(null)
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="bg-gradient-to-b from-primary to-primary-hover text-on-primary px-4 pt-6 pb-5">
        <div className="max-w-lg mx-auto flex items-center justify-center gap-3">
          <svg className="w-6 h-6 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 3v18M12 3l-4 4M12 3l4 4M4 15c2-1 4-1.5 8-1.5s6 .5 8 1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 className="text-xl font-semibold tracking-tight">Flight Prayer Times</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {result && input ? (
          <ResultsScreen result={result} input={input} settings={settings} onBack={handleBack} />
        ) : (
          <>
            <FlightForm
              onCalculate={handleCalculate}
              onOpenSettings={() => setSettingsOpen(true)}
              initialInput={input}
            />
            <InstallHint />
          </>
        )}
      </main>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        convention={settings.convention}
        asrSchool={settings.asrSchool}
        observationMethod={settings.observationMethod}
        onConvention={setConvention}
        onAsrSchool={setAsrSchool}
        onObservationMethod={setObservationMethod}
      />
    </div>
  )
}

export default App
