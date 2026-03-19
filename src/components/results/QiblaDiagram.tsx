import { useRef, useEffect, useCallback } from 'react'
import type { QiblaInfo } from '../../engine/types.ts'

interface Props {
  qibla: QiblaInfo
}

const DEG = Math.PI / 180

export function QiblaDiagram({ qibla }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const S = rect.width
    canvas.width = S * dpr
    canvas.height = S * dpr
    ctx.scale(dpr, dpr)

    const cx = S / 2
    const cy = S / 2
    const R = S * 0.38 // outer circle radius

    // Background circle (subtle)
    ctx.beginPath()
    ctx.arc(cx, cy, R + 8, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(100,116,139,0.06)'
    ctx.fill()

    // Compass ring
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(100,116,139,0.25)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Cardinal tick marks — rotated so that actual compass directions
    // are correct relative to the aircraft (up = direction of travel)
    const headingOffset = qibla.aircraftHeading // degrees clockwise from north
    const cardinals = [
      { angle: 0, label: 'N' },
      { angle: 90, label: 'E' },
      { angle: 180, label: 'S' },
      { angle: 270, label: 'W' },
    ]
    ctx.font = `bold ${S * 0.065}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(100,116,139,0.5)'
    for (const { angle, label } of cardinals) {
      // Rotate cardinal positions: subtract heading so N appears
      // at the correct position relative to direction of travel (up)
      const rad = (angle - headingOffset - 90) * DEG
      const tx = cx + (R + S * 0.055) * Math.cos(rad)
      const ty = cy + (R + S * 0.055) * Math.sin(rad)
      ctx.fillText(label, tx, ty)

      // Tick
      const inner = R - 4
      ctx.beginPath()
      ctx.moveTo(cx + inner * Math.cos(rad), cy + inner * Math.sin(rad))
      ctx.lineTo(cx + R * Math.cos(rad), cy + R * Math.sin(rad))
      ctx.strokeStyle = 'rgba(100,116,139,0.3)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Direction of travel arrow (pointing up = north in aircraft frame)
    // The aircraft heading is up in this diagram
    ctx.save()
    ctx.translate(cx, cy)

    // Draw plane body (pointing up)
    const planeLen = R * 0.5
    ctx.beginPath()
    ctx.moveTo(0, -planeLen)     // nose
    ctx.lineTo(4, -planeLen + 12)
    ctx.lineTo(4, -8)
    ctx.lineTo(18, 4)            // right wing tip
    ctx.lineTo(18, 8)
    ctx.lineTo(4, 2)
    ctx.lineTo(4, 14)
    ctx.lineTo(10, 20)           // right tail
    ctx.lineTo(10, 23)
    ctx.lineTo(0, 19)
    ctx.lineTo(-10, 23)          // left tail
    ctx.lineTo(-10, 20)
    ctx.lineTo(-4, 14)
    ctx.lineTo(-4, 2)
    ctx.lineTo(-18, 8)           // left wing tip
    ctx.lineTo(-18, 4)
    ctx.lineTo(-4, -8)
    ctx.lineTo(-4, -planeLen + 12)
    ctx.closePath()
    ctx.fillStyle = 'rgba(100,116,139,0.2)'
    ctx.strokeStyle = 'rgba(100,116,139,0.4)'
    ctx.lineWidth = 1
    ctx.fill()
    ctx.stroke()

    // Qibla arrow — relative to aircraft heading
    // relativeToCourse: positive = right, negative = left
    // In our diagram, up = direction of travel, so 0° relative = up
    const qiblaAngle = qibla.relativeToCourse * DEG // 0 = ahead (up)
    const absAngle = Math.abs(qibla.relativeToCourse)
    const arrowLen = R * 0.85
    const arrowX = arrowLen * Math.sin(qiblaAngle)
    const arrowY = -arrowLen * Math.cos(qiblaAngle)

    // Arrow line
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(arrowX, arrowY)
    ctx.strokeStyle = '#D97706'
    ctx.lineWidth = 2.5
    ctx.stroke()

    // Arrowhead
    const headLen = 10
    const headAngle = Math.atan2(arrowY, arrowX)
    ctx.beginPath()
    ctx.moveTo(arrowX, arrowY)
    ctx.lineTo(
      arrowX - headLen * Math.cos(headAngle - 0.4),
      arrowY - headLen * Math.sin(headAngle - 0.4),
    )
    ctx.lineTo(
      arrowX - headLen * Math.cos(headAngle + 0.4),
      arrowY - headLen * Math.sin(headAngle + 0.4),
    )
    ctx.closePath()
    ctx.fillStyle = '#D97706'
    ctx.fill()

    // Qibla label — offset to the side when nearly straight ahead to avoid overlap
    const labelDist = arrowLen + 16
    let labelX = labelDist * Math.sin(qiblaAngle)
    let labelY = -labelDist * Math.cos(qiblaAngle)
    if (absAngle < 20) {
      // Push the label to the right side to avoid overlapping "Direction of travel"
      const side = qibla.relativeToCourse >= 0 ? 1 : -1
      labelX = labelDist * Math.sin(Math.max(absAngle, 20) * DEG * side)
      labelY = -labelDist * Math.cos(Math.max(absAngle, 20) * DEG)
    }
    ctx.font = `bold ${S * 0.065}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#D97706'
    ctx.fillText('Qibla', labelX, labelY)

    // "Direction of travel" label — positioned below the nose
    ctx.font = `${S * 0.045}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(100,116,139,0.4)'
    ctx.fillText('Travel direction', 0, -planeLen + 24)

    // Angle arc from straight ahead to qibla (only if angle is significant)
    if (absAngle > 15) {
      const arcR = R * 0.3
      const startAngle = -Math.PI / 2 // straight up
      const endAngle = -Math.PI / 2 + qiblaAngle
      ctx.beginPath()
      ctx.arc(0, 0, arcR, startAngle, endAngle, qibla.relativeToCourse < 0)
      ctx.strokeStyle = 'rgba(217,119,6,0.4)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([3, 3])
      ctx.stroke()
      ctx.setLineDash([])

      // Angle label
      const midAngle = (startAngle + endAngle) / 2
      const angleLabelX = (arcR + 14) * Math.cos(midAngle)
      const angleLabelY = (arcR + 14) * Math.sin(midAngle)
      ctx.font = `bold ${S * 0.06}px Inter, system-ui, sans-serif`
      ctx.fillStyle = 'rgba(217,119,6,0.7)'
      ctx.fillText(`${Math.abs(Math.round(qibla.relativeToCourse))}°`, angleLabelX, angleLabelY)
    }

    ctx.restore()
  }, [qibla])

  useEffect(() => {
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      className="w-full aspect-square max-w-[240px] mx-auto"
      style={{ background: 'transparent' }}
    />
  )
}
