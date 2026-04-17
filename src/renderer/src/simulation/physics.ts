const GRAVITY = 9.81
const GRAVITY_SCALE = 4.0
const FRICTION = 0.990   // velocity multiplier per fixed step
const FIXED_DT = 1 / 120

/** XZ boundary at which the ball is considered to have left the platform */
export const PLATFORM_FALL_THRESHOLD = 2.55

export interface PhysicsState {
  x: number
  z: number
  vx: number
  vz: number
  accumulator: number
}

export function createPhysicsState(): PhysicsState {
  return { x: 0, z: 0, vx: 0, vz: 0, accumulator: 0 }
}

export function stepPhysics(
  state: PhysicsState,
  rollRad: number,
  pitchRad: number,
  dt: number
): void {
  state.accumulator += dt

  while (state.accumulator >= FIXED_DT) {
    const accelX = -Math.sin(rollRad) * GRAVITY * GRAVITY_SCALE
    const accelZ =  Math.sin(pitchRad) * GRAVITY * GRAVITY_SCALE

    state.vx += accelX * FIXED_DT
    state.vz += accelZ * FIXED_DT

    state.vx *= FRICTION
    state.vz *= FRICTION

    state.x += state.vx * FIXED_DT
    state.z += state.vz * FIXED_DT

    state.accumulator -= FIXED_DT
  }
}
