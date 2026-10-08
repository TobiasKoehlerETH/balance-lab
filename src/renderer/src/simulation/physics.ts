const GRAVITY = 9.81
const GRAVITY_SCALE = 5.5
// Keep momentum longer so a late correction cannot immediately stop the sphere.
const FRICTION = 0.997   // velocity multiplier per fixed step
const FIXED_DT = 1 / 120

/** XZ boundary at which the ball is considered to have left the platform */
// The sphere must stay fully on the 5-unit platform (half width minus radius).
export const PLATFORM_FALL_THRESHOLD = 2.2

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
  dt: number,
  rollingSpeed = 1
): void {
  // Scale simulation time so existing momentum responds to the slider immediately.
  state.accumulator += dt * rollingSpeed

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
