import { describe, it, expect } from 'vitest'
import { qiblaBearing, qiblaInfo } from './qibla'

describe('Qibla Bearing', () => {
  it('from Washington DC is roughly ENE (~58°)', () => {
    const b = qiblaBearing(38.9, -77.0)
    expect(b).toBeGreaterThan(50)
    expect(b).toBeLessThan(65)
  })

  it('from London is roughly ESE (~119°)', () => {
    const b = qiblaBearing(51.5, -0.1)
    expect(b).toBeGreaterThan(115)
    expect(b).toBeLessThan(125)
  })

  it('from Tokyo is roughly WSW (~253°)', () => {
    const b = qiblaBearing(35.7, 139.7)
    expect(b).toBeGreaterThan(250)
    expect(b).toBeLessThan(295)
  })

  it('from Makkah itself is ~0 (or any value — distance is ~0)', () => {
    // Bearing is not well-defined at the destination itself
    // Just verify it does not throw
    qiblaBearing(21.4225, 39.8262)
  })
})

describe('Qibla Relative to Course', () => {
  it('Qibla to the right when heading north and Qibla is east', () => {
    const info = qiblaInfo(38.9, -77.0, 0) // heading north, Qibla ~58°
    expect(info.relativeToCourse).toBeGreaterThan(40)
    expect(info.relativeToCourse).toBeLessThan(70)
  })

  it('Qibla to the left when heading south and Qibla is east', () => {
    const info = qiblaInfo(38.9, -77.0, 180) // heading south, Qibla ~58°
    // relative = 58 - 180 = -122 (to the left)
    expect(info.relativeToCourse).toBeLessThan(0)
  })

  it('normalizes to -180..180', () => {
    const info = qiblaInfo(51.5, -0.1, 350) // heading 350, Qibla ~119
    // relative = 119 - 350 = -231 → +129
    expect(info.relativeToCourse).toBeGreaterThan(-180)
    expect(info.relativeToCourse).toBeLessThanOrEqual(180)
  })
})
