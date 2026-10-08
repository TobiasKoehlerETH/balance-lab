import { describe, expect, it } from 'vitest'
import { createPhysicsState, stepPhysics } from '../src/renderer/src/simulation/physics'

describe('rolling speed', () => {
  it.each([0.25, 0.5, 1, 2])('runs the same trajectory at %s times normal speed', (speed) => {
    const scaled = createPhysicsState()
    const normal = createPhysicsState()
    scaled.vx = normal.vx = 1
    scaled.vz = normal.vz = -0.5

    for (let frame = 0; frame < 120; frame++) {
      stepPhysics(scaled, 0.1, -0.05, 1 / 120, speed)
    }
    for (let frame = 0; frame < 120 * speed; frame++) {
      stepPhysics(normal, 0.1, -0.05, 1 / 120)
    }

    expect(scaled.x).toBeCloseTo(normal.x, 10)
    expect(scaled.z).toBeCloseTo(normal.z, 10)
    expect(scaled.vx).toBeCloseTo(normal.vx, 10)
    expect(scaled.vz).toBeCloseTo(normal.vz, 10)
  })

  it('slows an already moving sphere immediately without resetting its position', () => {
    const moving = createPhysicsState()
    moving.vx = 1
    stepPhysics(moving, 0, 0, 0.5)
    const previousX = moving.x
    const slow = { ...moving }
    const fast = { ...moving }

    stepPhysics(slow, 0, 0, 1 / 30, 0.25)
    stepPhysics(fast, 0, 0, 1 / 30, 2)

    expect(slow.x).toBeGreaterThan(previousX)
    expect(fast.x - previousX).toBeGreaterThan((slow.x - previousX) * 7)
    expect(slow.vx).toBeGreaterThan(0)
  })

  it.each([0.25, 2])('keeps %s times speed consistent at different frame rates', (speed) => {
    const lowFrameRate = createPhysicsState()
    const highFrameRate = createPhysicsState()

    for (let frame = 0; frame < 30; frame++) {
      stepPhysics(lowFrameRate, -0.1, 0.1, 1 / 30, speed)
    }
    for (let frame = 0; frame < 120; frame++) {
      stepPhysics(highFrameRate, -0.1, 0.1, 1 / 120, speed)
    }

    expect(lowFrameRate.x).toBeCloseTo(highFrameRate.x, 10)
    expect(lowFrameRate.z).toBeCloseTo(highFrameRate.z, 10)
  })
})
