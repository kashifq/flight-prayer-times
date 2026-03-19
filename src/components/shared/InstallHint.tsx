import { useState } from 'react'

const DISMISSED_KEY = 'install-hint-dismissed'

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone === true)
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

export function InstallHint() {
  const [dismissed, setDismissed] = useState(() => {
    if (isStandalone()) return true
    return localStorage.getItem(DISMISSED_KEY) === '1'
  })

  if (dismissed) return null

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="mt-6 bg-surface border border-outline-variant rounded-xl p-4 text-sm text-on-surface-variant">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-on-surface mb-1">Works offline</p>
          <p>
            {isIOS()
              ? <>Tap <span className="inline-flex items-center align-text-bottom mx-0.5"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M12 5l-3 3M12 5l3 3M5 12h14" strokeLinecap="round" strokeLinejoin="round" transform="rotate(180 12 12)"/><rect x="4" y="16" width="16" height="3" rx="1" strokeWidth="1.5"/></svg></span> then <strong>"Add to Home Screen"</strong> to install this app. It works without internet — perfect for in-flight use.</>
              : <>Add this app to your home screen for an app-like experience that works without internet — perfect for in-flight use.</>
            }
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-on-surface-variant/60 hover:text-on-surface transition-colors shrink-0 mt-0.5"
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
