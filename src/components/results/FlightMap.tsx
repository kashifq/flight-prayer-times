import { useRef, useEffect, useCallback, useState } from 'react'
import type { FlightPoint, FlightInput } from '../../engine/types.ts'
import { interpolateGreatCircle } from '../../engine/flight-path.ts'
import { julianDay, julianCentury, sunDeclination, equationOfTime } from '../../engine/solar.ts'
import { COASTLINES } from '../../data/coastlines.ts'

interface Props {
  flightPath: FlightPoint[]
  input: FlightInput
  projected: { lat: number; lon: number; fraction: number } | null
  override: { lat: number; lon: number } | null
  onTapPosition?: (lat: number, lon: number) => void
  highlightPosition?: { lat: number; lon: number } | null
  terminatorUtc?: Date | null
  height?: number
  /** When set, the route was recalculated from this fix point */
  fix?: { lat: number; lon: number } | null
}

const COLORS = {
  ocean: '#0f172a',
  land: '#334155',
  landBorder: '#475569',
  grid: 'rgba(100,116,139,0.2)',
  route: '#fbbf24',
  routePast: 'rgba(251,191,36,0.3)',
  departure: '#f59e0b',
  arrival: '#f59e0b',
  plane: '#ffffff',
  planeGlow: 'rgba(251,191,36,0.4)',
  override: '#ef4444',
  highlight: '#22d3ee',
  highlightGlow: 'rgba(34,211,238,0.4)',
  night: 'rgba(0,0,20,0.55)',
  day: 'rgba(56,120,180,0.15)',
  terminator: 'rgba(251,191,36,0.5)',
}

const DEG = Math.PI / 180
const RAD = 180 / Math.PI
const MIN_ZOOM = 0.3
const MAX_ZOOM = 8
const TAP_THRESHOLD = 8 // pixels — movement below this counts as a tap

export function FlightMap({
  flightPath, input, projected, override, onTapPosition,
  highlightPosition, terminatorUtc, height = 200, fix,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [panLon, setPanLon] = useState(0)
  const [panLat, setPanLat] = useState(0)
  const [zoom, setZoom] = useState(1)

  // Refs for gesture state (avoid re-renders during drag)
  const gestureRef = useRef<{
    type: 'pan' | 'pinch'
    startX: number; startY: number
    startPanLon: number; startPanLat: number
    startDist: number; startZoom: number
    moved: boolean
  } | null>(null)

  const currentPos = override ?? (projected ? { lat: projected.lat, lon: projected.lon } : null)

  const getDefaultViewport = useCallback(() => {
    const lats = flightPath.length > 0 ? flightPath.map(p => p.lat) : [input.departure.lat, input.arrival.lat]
    const lons = flightPath.length > 0 ? flightPath.map(p => p.lon) : [input.departure.lon, input.arrival.lon]
    const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2
    const centerLon = (Math.max(...lons) + Math.min(...lons)) / 2
    const latSpan = Math.max(Math.max(...lats) - Math.min(...lats) + 20, 40)
    const lonSpan = Math.max(Math.max(...lons) - Math.min(...lons) + 20, 40)
    return { centerLat, centerLon, latSpan, lonSpan }
  }, [flightPath, input])

  const getViewport = useCallback((W: number, H: number) => {
    const dv = getDefaultViewport()
    const aspect = W / H
    const baseLonSpan = Math.max(dv.lonSpan, dv.latSpan * aspect)
    const viewLon = baseLonSpan / zoom
    const viewLat = viewLon / aspect
    const cLat = dv.centerLat + panLat
    const cLon = dv.centerLon + panLon
    return {
      minLon: cLon - viewLon / 2, maxLon: cLon + viewLon / 2,
      minLat: cLat - viewLat / 2, maxLat: cLat + viewLat / 2,
      viewLon, viewLat,
    }
  }, [getDefaultViewport, panLon, panLat, zoom])

  // --- Drawing ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const W = rect.width
    const H = rect.height
    const { minLon, maxLon, minLat, maxLat, viewLon } = getViewport(W, H)

    function toX(lon: number) { return ((lon - minLon) / (maxLon - minLon)) * W }
    function toY(lat: number) { return ((maxLat - lat) / (maxLat - minLat)) * H }

    ctx.fillStyle = COLORS.ocean
    ctx.fillRect(0, 0, W, H)

    // Terminator (draw before land so land overlaps slightly)
    if (terminatorUtc) {
      drawTerminator(ctx, W, H, minLon, maxLon, maxLat, toX, toY, terminatorUtc)
    }

    // Grid
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = 0.5
    const gridStep = viewLon > 120 ? 30 : viewLon > 60 ? 15 : viewLon > 30 ? 10 : 5
    for (let lon = Math.ceil(minLon / gridStep) * gridStep; lon <= maxLon; lon += gridStep) {
      ctx.beginPath(); ctx.moveTo(toX(lon), 0); ctx.lineTo(toX(lon), H); ctx.stroke()
    }
    for (let lat = Math.ceil(minLat / gridStep) * gridStep; lat <= maxLat; lat += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, toY(lat)); ctx.lineTo(W, toY(lat)); ctx.stroke()
    }

    // Coastlines
    ctx.fillStyle = COLORS.land
    ctx.strokeStyle = COLORS.landBorder
    ctx.lineWidth = 0.5
    for (const poly of COASTLINES) {
      // Quick check: skip polygons entirely outside viewport
      let anyVisible = false
      for (const [lon, lat] of poly) {
        if (lon >= minLon - 5 && lon <= maxLon + 5 && lat >= minLat - 5 && lat <= maxLat + 5) {
          anyVisible = true; break
        }
      }
      if (!anyVisible) continue

      ctx.beginPath()
      for (let i = 0; i < poly.length; i++) {
        const [lon, lat] = poly[i]
        if (i === 0) ctx.moveTo(toX(lon), toY(lat))
        else ctx.lineTo(toX(lon), toY(lat))
      }
      ctx.closePath(); ctx.fill(); ctx.stroke()
    }

    // Route — original great circle (departure → arrival)
    const origPoints: { x: number; y: number }[] = []
    const segments = 200
    for (let i = 0; i <= segments; i++) {
      const f = i / segments
      const p = interpolateGreatCircle(
        input.departure.lat, input.departure.lon,
        input.arrival.lat, input.arrival.lon, f,
      )
      origPoints.push({ x: toX(p.lon), y: toY(p.lat) })
    }

    if (fix) {
      // Draw original route fully dimmed
      ctx.strokeStyle = COLORS.routePast; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4])
      ctx.beginPath()
      for (let i = 0; i < origPoints.length; i++) {
        if (i === 0) ctx.moveTo(origPoints[i].x, origPoints[i].y)
        else ctx.lineTo(origPoints[i].x, origPoints[i].y)
      }
      ctx.stroke(); ctx.setLineDash([])

      // Draw adjusted route (fix → arrival) bright
      const adjPoints: { x: number; y: number }[] = []
      for (let i = 0; i <= segments; i++) {
        const f = i / segments
        const p = interpolateGreatCircle(fix.lat, fix.lon, input.arrival.lat, input.arrival.lon, f)
        adjPoints.push({ x: toX(p.lon), y: toY(p.lat) })
      }
      ctx.strokeStyle = COLORS.route; ctx.lineWidth = 2.5; ctx.setLineDash([])
      ctx.beginPath()
      for (let i = 0; i < adjPoints.length; i++) {
        if (i === 0) ctx.moveTo(adjPoints[i].x, adjPoints[i].y)
        else ctx.lineTo(adjPoints[i].x, adjPoints[i].y)
      }
      ctx.stroke()
    } else if (projected && projected.fraction > 0) {
      // No fix — draw original route with past/future split
      const splitIdx = Math.round(projected.fraction * segments)
      ctx.strokeStyle = COLORS.routePast; ctx.lineWidth = 2; ctx.setLineDash([])
      ctx.beginPath()
      for (let i = 0; i <= splitIdx && i < origPoints.length; i++) {
        if (i === 0) ctx.moveTo(origPoints[i].x, origPoints[i].y)
        else ctx.lineTo(origPoints[i].x, origPoints[i].y)
      }
      ctx.stroke()

      ctx.strokeStyle = COLORS.route; ctx.lineWidth = 2; ctx.setLineDash([6, 4])
      ctx.beginPath()
      for (let i = splitIdx; i < origPoints.length; i++) {
        if (i === splitIdx) ctx.moveTo(origPoints[i].x, origPoints[i].y)
        else ctx.lineTo(origPoints[i].x, origPoints[i].y)
      }
      ctx.stroke(); ctx.setLineDash([])
    } else {
      // Before departure — draw full route dashed
      ctx.strokeStyle = COLORS.route; ctx.lineWidth = 2; ctx.setLineDash([6, 4])
      ctx.beginPath()
      for (let i = 0; i < origPoints.length; i++) {
        if (i === 0) ctx.moveTo(origPoints[i].x, origPoints[i].y)
        else ctx.lineTo(origPoints[i].x, origPoints[i].y)
      }
      ctx.stroke(); ctx.setLineDash([])
    }

    // Markers
    drawMarker(ctx, toX(input.departure.lon), toY(input.departure.lat), COLORS.departure, input.departure.iata)
    drawMarker(ctx, toX(input.arrival.lon), toY(input.arrival.lat), COLORS.arrival, input.arrival.iata)

    // Highlight position
    if (highlightPosition) {
      const hx = toX(highlightPosition.lon); const hy = toY(highlightPosition.lat)
      ctx.beginPath(); ctx.arc(hx, hy, 12, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.highlightGlow; ctx.fill()
      ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.highlight; ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
    }

    // Current position plane
    if (currentPos) {
      const px = toX(currentPos.lon); const py = toY(currentPos.lat)
      ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.planeGlow; ctx.fill()
      ctx.save(); ctx.translate(px, py)
      const heading = getHeadingAtPosition(currentPos.lat, currentPos.lon, input)
      ctx.rotate((-heading + 90) * Math.PI / 180)
      ctx.beginPath()
      ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 3); ctx.lineTo(-5, 5)
      ctx.closePath(); ctx.fillStyle = COLORS.plane; ctx.fill()
      ctx.restore()
    }

    // Override marker
    if (override && projected) {
      const ox = toX(override.lon); const oy = toY(override.lat)
      ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.override; ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke()
    }
  }, [flightPath, input, projected, override, currentPos, highlightPosition, terminatorUtc, getViewport, fix])

  useEffect(() => {
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [draw])

  // --- Native touch event handlers (passive: false so preventDefault works) ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 1) {
        const t = e.touches[0]
        gestureRef.current = {
          type: 'pan',
          startX: t.clientX, startY: t.clientY,
          startPanLon: panLon, startPanLat: panLat,
          startDist: 0, startZoom: zoom, moved: false,
        }
      } else if (e.touches.length === 2) {
        const dx = e.touches[1].clientX - e.touches[0].clientX
        const dy = e.touches[1].clientY - e.touches[0].clientY
        gestureRef.current = {
          type: 'pinch',
          startX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          startY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
          startPanLon: panLon, startPanLat: panLat,
          startDist: Math.sqrt(dx * dx + dy * dy),
          startZoom: zoom, moved: false,
        }
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!gestureRef.current) return
      e.preventDefault() // This works because we pass { passive: false }

      const rect = canvas!.getBoundingClientRect()
      const W = rect.width; const H = rect.height
      const vp = getViewport(W, H)

      if (gestureRef.current.type === 'pan' && e.touches.length === 1) {
        const t = e.touches[0]
        const dxPx = t.clientX - gestureRef.current.startX
        const dyPx = t.clientY - gestureRef.current.startY
        if (Math.abs(dxPx) > TAP_THRESHOLD || Math.abs(dyPx) > TAP_THRESHOLD) {
          gestureRef.current.moved = true
        }
        const dLon = -(dxPx / W) * vp.viewLon
        const dLat = (dyPx / H) * vp.viewLat
        setPanLon(gestureRef.current.startPanLon + dLon)
        setPanLat(gestureRef.current.startPanLat + dLat)
      } else if (gestureRef.current.type === 'pinch' && e.touches.length === 2) {
        gestureRef.current.moved = true
        const dx = e.touches[1].clientX - e.touches[0].clientX
        const dy = e.touches[1].clientY - e.touches[0].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const scale = dist / gestureRef.current.startDist
        setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, gestureRef.current.startZoom * scale)))
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (gestureRef.current && !gestureRef.current.moved && e.changedTouches.length === 1 && onTapPosition) {
        // It was a tap — convert to lat/lon
        const t = e.changedTouches[0]
        const rect = canvas!.getBoundingClientRect()
        const W = rect.width; const H = rect.height
        const vp = getViewport(W, H)
        const clickX = t.clientX - rect.left
        const clickY = t.clientY - rect.top
        const lon = vp.minLon + (clickX / W) * vp.viewLon
        const lat = vp.maxLat - (clickY / H) * vp.viewLat
        onTapPosition(lat, lon)
      }
      gestureRef.current = null
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [panLon, panLat, zoom, getViewport, onTapPosition])

  // --- Mouse handlers for desktop: drag to pan, click to set position ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return // left button only
      gestureRef.current = {
        type: 'pan',
        startX: e.clientX, startY: e.clientY,
        startPanLon: panLon, startPanLat: panLat,
        startDist: 0, startZoom: zoom, moved: false,
      }
      canvas!.style.cursor = 'grabbing'
    }

    function onMouseMove(e: MouseEvent) {
      if (!gestureRef.current) return
      const rect = canvas!.getBoundingClientRect()
      const W = rect.width; const H = rect.height
      const vp = getViewport(W, H)
      const dxPx = e.clientX - gestureRef.current.startX
      const dyPx = e.clientY - gestureRef.current.startY
      if (Math.abs(dxPx) > TAP_THRESHOLD || Math.abs(dyPx) > TAP_THRESHOLD) {
        gestureRef.current.moved = true
      }
      const dLon = -(dxPx / W) * vp.viewLon
      const dLat = (dyPx / H) * vp.viewLat
      setPanLon(gestureRef.current.startPanLon + dLon)
      setPanLat(gestureRef.current.startPanLat + dLat)
    }

    function onMouseUp(e: MouseEvent) {
      if (gestureRef.current && !gestureRef.current.moved && onTapPosition) {
        const rect = canvas!.getBoundingClientRect()
        const W = rect.width; const H = rect.height
        const vp = getViewport(W, H)
        const lon = vp.minLon + ((e.clientX - rect.left) / W) * vp.viewLon
        const lat = vp.maxLat - ((e.clientY - rect.top) / H) * vp.viewLat
        onTapPosition(lat, lon)
      }
      gestureRef.current = null
      canvas!.style.cursor = onTapPosition ? 'crosshair' : 'grab'
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * delta)))
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [panLon, panLat, zoom, getViewport, onTapPosition])

  function handleResetView() {
    setPanLon(0); setPanLat(0); setZoom(1)
  }

  const isPanned = panLon !== 0 || panLat !== 0 || zoom !== 1

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full rounded-xl border border-outline-variant"
        style={{ height, background: COLORS.ocean, touchAction: 'none', cursor: onTapPosition ? 'crosshair' : 'grab' }}
      />
      {isPanned && (
        <button
          type="button"
          onClick={handleResetView}
          className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-medium
                     px-2 py-1 rounded-md backdrop-blur-sm hover:bg-black/70 transition-colors"
        >
          Reset view
        </button>
      )}
    </div>
  )
}

// --- Day/night terminator ---
function drawTerminator(
  ctx: CanvasRenderingContext2D,
  W: number, _H: number,
  minLon: number, maxLon: number, _maxLat: number,
  toX: (lon: number) => number, toY: (lat: number) => number,
  utc: Date,
) {
  const jd = julianDay(utc)
  const T = julianCentury(jd)
  const dec = sunDeclination(T)
  const eqTime = equationOfTime(T)

  const utcMinutes = utc.getUTCHours() * 60 + utc.getUTCMinutes() + utc.getUTCSeconds() / 60
  const subSolarLon = ((720 - utcMinutes - eqTime) / 4 + 540) % 360 - 180

  const decRad = dec * DEG
  const tanDec = Math.tan(decRad)

  // Trace the terminator: for each longitude, find the latitude where sun altitude = 0
  const step = Math.max((maxLon - minLon) / W, 0.5)
  const terminatorTop: { x: number; y: number }[] = []
  const terminatorBot: { x: number; y: number }[] = []

  for (let lon = minLon; lon <= maxLon; lon += step) {
    const ha = ((lon - subSolarLon + 540) % 360 - 180) * DEG
    let termLat: number
    if (Math.abs(tanDec) < 1e-10) {
      termLat = Math.abs(ha * RAD) < 90 ? 90 : -90
    } else {
      termLat = Math.atan(-Math.cos(ha) / tanDec) * RAD
    }

    const x = toX(lon)
    const latRad = (termLat + 1) * DEG
    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(ha)
    const nightAbove = sinAlt < 0

    if (nightAbove) {
      terminatorTop.push({ x, y: toY(90) })
      terminatorBot.push({ x, y: toY(termLat) })
    } else {
      terminatorTop.push({ x, y: toY(termLat) })
      terminatorBot.push({ x, y: toY(-90) })
    }
  }

  if (terminatorTop.length > 0) {
    // Night side (darker overlay)
    ctx.fillStyle = COLORS.night
    ctx.beginPath()
    ctx.moveTo(terminatorTop[0].x, terminatorTop[0].y)
    for (const p of terminatorTop) ctx.lineTo(p.x, p.y)
    for (let i = terminatorBot.length - 1; i >= 0; i--) ctx.lineTo(terminatorBot[i].x, terminatorBot[i].y)
    ctx.closePath()
    ctx.fill()

    // Day side (lighter tint to create contrast)
    // The day region is the complement of the night region
    const termLine: { x: number; y: number }[] = []
    for (let i = 0; i < terminatorTop.length; i++) {
      const p = terminatorTop[i]
      const b = terminatorBot[i]
      termLine.push({ x: p.x, y: (p.y === toY(90)) ? b.y : p.y })
    }
    ctx.fillStyle = COLORS.day
    ctx.beginPath()
    // Trace the terminator line, then close via the opposite edge
    ctx.moveTo(termLine[0].x, termLine[0].y)
    for (const p of termLine) ctx.lineTo(p.x, p.y)
    // Determine which edge the day side extends to
    const nightAboveFirst = terminatorTop[0].y === toY(90)
    if (nightAboveFirst) {
      // Night is above → day is below
      ctx.lineTo(termLine[termLine.length - 1].x, toY(-90))
      ctx.lineTo(termLine[0].x, toY(-90))
    } else {
      // Night is below → day is above
      ctx.lineTo(termLine[termLine.length - 1].x, toY(90))
      ctx.lineTo(termLine[0].x, toY(90))
    }
    ctx.closePath()
    ctx.fill()

    // Terminator line (brighter)
    ctx.strokeStyle = COLORS.terminator
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < termLine.length; i++) {
      if (i === 0) ctx.moveTo(termLine[i].x, termLine[i].y)
      else ctx.lineTo(termLine[i].x, termLine[i].y)
    }
    ctx.stroke()
  }
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string) {
  ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2)
  ctx.fillStyle = color; ctx.fill()
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.font = 'bold 10px Inter, system-ui, sans-serif'
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'
  ctx.fillText(label, x, y - 8)
}

function getHeadingAtPosition(lat: number, lon: number, input: FlightInput): number {
  const lat1 = lat * DEG; const lat2 = input.arrival.lat * DEG
  const dLon = (input.arrival.lon - lon) * DEG
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (Math.atan2(y, x) * RAD + 360) % 360
}
