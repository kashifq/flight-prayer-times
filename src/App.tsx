import { useState } from 'react'
import type { FlightInput, CalculationResult } from './engine/types.ts'
import { computeFlightPrayerTimes } from './engine/index.ts'
import { useSettings } from './hooks/useSettings.ts'
import { FlightForm } from './components/input/FlightForm.tsx'
import { InstallHint } from './components/shared/InstallHint.tsx'
import { UpdatePrompt } from './components/shared/UpdatePrompt.tsx'
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
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-6" />
          <div className="flex-1 flex items-center justify-center gap-3">
            <svg className="w-6 h-6 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 3v18M12 3l-4 4M12 3l4 4M4 15c2-1 4-1.5 8-1.5s6 .5 8 1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h1 className="text-xl font-semibold tracking-tight">Flight Prayer Times</h1>
          </div>
          <a href="https://github.com/kashifq/flight-prayer-times" target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity" aria-label="View on GitHub">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
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

      <UpdatePrompt />
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
