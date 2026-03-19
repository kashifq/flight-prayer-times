import { useState, useEffect } from 'react'

export function useNow(): { now: Date; isDebugTime: boolean } {
  const params = new URLSearchParams(window.location.search)
  const nowParam = params.get('now')
  const debugDate = nowParam ? new Date(nowParam) : null
  const isDebugTime = debugDate !== null && !isNaN(debugDate.getTime())

  const [now, setNow] = useState(() => (isDebugTime ? debugDate! : new Date()))

  useEffect(() => {
    if (isDebugTime) return
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [isDebugTime])

  return { now, isDebugTime }
}
