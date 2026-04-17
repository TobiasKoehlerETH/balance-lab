import * as THREE from 'three'

const TRAIL_MAX = 512
const TRAIL_POINT_SIZE = 4   // screen pixels (sizeAttenuation: false)
const TRAIL_SAMPLE_INTERVAL = 0.04  // seconds between samples
const TRAIL_LIFETIME = 1.8          // seconds before a point fades out
const TRAIL_SKIP_RECENT = 0         // no gap — trail reaches the ball

interface TrailPoint {
  x: number
  z: number
  y: number
  born: number  // elapsed time when born
}

export class Trail {
  readonly object: THREE.Points
  private points: TrailPoint[] = []
  private positions: Float32Array
  private colors: Float32Array
  private geometry: THREE.BufferGeometry
  private lastSampleTime = 0

  constructor() {
    this.positions = new Float32Array(TRAIL_MAX * 3)
    this.colors = new Float32Array(TRAIL_MAX * 3)

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    this.geometry.setDrawRange(0, 0)

    const material = new THREE.PointsMaterial({
      size: TRAIL_POINT_SIZE,
      sizeAttenuation: false,  // size in screen pixels, not world units
      vertexColors: true,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      blending: THREE.AdditiveBlending
    })

    this.object = new THREE.Points(this.geometry, material)
    this.object.renderOrder = 1
  }

  sample(x: number, z: number, platformY: number, elapsed: number): void {
    if (elapsed - this.lastSampleTime < TRAIL_SAMPLE_INTERVAL) return
    this.lastSampleTime = elapsed

    this.points.push({ x, z, y: platformY, born: elapsed })
    if (this.points.length > TRAIL_MAX) this.points.shift()
  }

  clear(): void {
    this.points = []
    this.lastSampleTime = 0
    this.geometry.setDrawRange(0, 0)
    this.geometry.attributes.position.needsUpdate = true
  }

  update(elapsed: number): void {
    // Cull expired points
    this.points = this.points.filter((p) => elapsed - p.born < TRAIL_LIFETIME)

    const count = this.points.length
    for (let i = 0; i < count; i++) {
      const p = this.points[i]
      const age = elapsed - p.born
      const alpha = Math.max(0, 1 - age / TRAIL_LIFETIME)
      // HDR value so ACES tonemapping renders bright white
      const brightness = alpha * 2.5

      this.positions[i * 3 + 0] = p.x
      this.positions[i * 3 + 1] = p.y
      this.positions[i * 3 + 2] = p.z

      this.colors[i * 3 + 0] = brightness
      this.colors[i * 3 + 1] = brightness
      this.colors[i * 3 + 2] = brightness
    }

    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.color.needsUpdate = true
    // Skip the most recent points so the trail starts behind the sphere
    this.geometry.setDrawRange(0, Math.max(0, count - TRAIL_SKIP_RECENT))
  }
}
