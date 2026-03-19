import { CONVENTIONS } from '../../engine/conventions.ts'
import type { ConventionId, AsrSchool, ObservationMethod } from '../../engine/types.ts'

interface Props {
  open: boolean
  onClose: () => void
  convention: ConventionId
  asrSchool: AsrSchool
  observationMethod: ObservationMethod
  onConvention: (v: ConventionId) => void
  onAsrSchool: (v: AsrSchool) => void
  onObservationMethod: (v: ObservationMethod) => void
}

const OBSERVATION_METHODS: { id: ObservationMethod; label: string; desc: string }[] = [
  { id: 'altitude-adjusted', label: 'Observed (altitude-adjusted)', desc: 'Uses aircraft altitude to compute depressed horizon. Most astronomically accurate.' },
  { id: 'ground-level', label: 'Ground level at aircraft position', desc: 'Ignores altitude. Computes as if on the ground below the aircraft.' },
  { id: 'departure-city', label: 'Departure city', desc: 'Static prayer times for the departure city.' },
  { id: 'arrival-city', label: 'Arrival city', desc: 'Static prayer times for the arrival city.' },
]

export function SettingsSheet({ open, onClose, convention, asrSchool, observationMethod, onConvention, onAsrSchool, onObservationMethod }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface rounded-t-2xl shadow-xl
                      max-h-[85vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-surface px-5 pt-4 pb-2 border-b border-outline-variant z-10">
          <div className="w-10 h-1 bg-outline rounded-full mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-on-surface">Calculation Settings</h2>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* Convention */}
          <section>
            <h3 className="text-xs font-semibold text-accent mb-2 uppercase tracking-wider">Convention</h3>
            <div className="space-y-1">
              {(Object.entries(CONVENTIONS) as [ConventionId, typeof CONVENTIONS[ConventionId]][]).map(([id, conv]) => (
                <label key={id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-surface-variant cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="convention"
                    checked={convention === id}
                    onChange={() => onConvention(id)}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <div className="text-sm font-medium text-on-surface">{conv.name}</div>
                    <div className="text-xs text-on-surface-variant">
                      Fajr {conv.fajrAngle}° &middot; Isha {conv.ishaAngle ? `${conv.ishaAngle}°` : `${conv.ishaMinutesAfterMaghrib} min after Maghrib`}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Asr School */}
          <section>
            <h3 className="text-xs font-semibold text-accent mb-2 uppercase tracking-wider">Asr Calculation</h3>
            <div className="space-y-1">
              <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-surface-variant cursor-pointer transition-colors">
                <input type="radio" name="asr" checked={asrSchool === 'hanafi'} onChange={() => onAsrSchool('hanafi')} className="mt-0.5 accent-primary" />
                <div>
                  <div className="text-sm font-medium text-on-surface">Hanafi</div>
                  <div className="text-xs text-on-surface-variant">Shadow = 2x object height + noon shadow</div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-surface-variant cursor-pointer transition-colors">
                <input type="radio" name="asr" checked={asrSchool === 'standard'} onChange={() => onAsrSchool('standard')} className="mt-0.5 accent-primary" />
                <div>
                  <div className="text-sm font-medium text-on-surface">Others (Shafi'i, Maliki, Hanbali)</div>
                  <div className="text-xs text-on-surface-variant">Shadow = object height + noon shadow</div>
                </div>
              </label>
            </div>
          </section>

          {/* Observation Method */}
          <section>
            <h3 className="text-xs font-semibold text-accent mb-2 uppercase tracking-wider">Flight Observation Method</h3>
            <div className="space-y-1">
              {OBSERVATION_METHODS.map((m) => (
                <label key={m.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-surface-variant cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="observation"
                    checked={observationMethod === m.id}
                    onChange={() => onObservationMethod(m.id)}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <div className="text-sm font-medium text-on-surface">{m.label}</div>
                    <div className="text-xs text-on-surface-variant">{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 bg-surface px-5 py-4 border-t border-outline-variant">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-full bg-primary text-on-primary font-semibold
                       hover:bg-primary-hover active:scale-[0.98] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
