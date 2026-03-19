import { useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)

  const [updateSW] = useState(() =>
    registerSW({
      onNeedRefresh() {
        setNeedRefresh(true)
      },
    })
  )

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center">
      <div className="bg-surface border border-outline-variant rounded-xl px-4 py-3 shadow-lg
                      flex items-center gap-3 max-w-sm w-full">
        <p className="text-sm text-on-surface flex-1">A new version is available.</p>
        <button
          type="button"
          onClick={() => updateSW(true)}
          className="px-3 py-1.5 rounded-full bg-primary text-on-primary text-sm font-medium
                     hover:bg-primary-hover active:scale-[0.97] transition-all whitespace-nowrap"
        >
          Update
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="text-on-surface-variant/60 hover:text-on-surface transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
