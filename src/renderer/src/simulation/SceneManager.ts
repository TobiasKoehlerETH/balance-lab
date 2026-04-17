import * as THREE from 'three'
import { createSphereShader, SphereShader } from './sphere-shader'
import { Trail } from './trail'
import { createPhysicsState, stepPhysics, PhysicsState, PLATFORM_FALL_THRESHOLD } from './physics'

const PLATFORM_W = 5.0
const PLATFORM_H = 0.08
const SPHERE_RADIUS = 0.25
const SPHERE_Y = PLATFORM_H / 2 + SPHERE_RADIUS   // resting Y in platform-local space

const DROP_HEIGHT      = 5.0   // units above SPHERE_Y the ball starts dropping from
const DROP_DURATION    = 0.55  // seconds to fall to platform
const RECOVER_DURATION = 5.5   // seconds: ~0.75s fly-off + 5s message display before respawn
const FALL_GRAVITY     = 12.0  // local-Y acceleration during fall-off animation


// Demo Lissajous tilt
const DEMO_ROLL_AMP   = 0.22
const DEMO_PITCH_AMP  = 0.22
const DEMO_ROLL_FREQ  = 0.65
const DEMO_PITCH_FREQ = 1.05

type GameState = 'playing' | 'recovering' | 'dropping'

export class SceneManager {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private clock: THREE.Clock
  private platform: THREE.Mesh
  private sphere: THREE.Mesh
  private shadowBlob: THREE.Mesh
  private sphereShader: SphereShader
  private sphereQuat: THREE.Quaternion
  private trail: Trail
  private physics: PhysicsState
  private raf = 0
  private isDemo = true

  // Game state machine
  private gameState: GameState = 'dropping'
  private stateElapsed = 0
  private survivalStart = 0
  private lastBallX = 0
  private lastBallZ = 0
  private lastBallVx = 0
  private lastBallVz = 0

  onOrientation?: (rollRad: number, pitchRad: number) => void
  onStats?: (survivalSeconds: number, isPlaying: boolean) => void

  constructor(private readonly container: HTMLElement) {
    this.clock = new THREE.Clock()
    this.sphereQuat = new THREE.Quaternion()
    this.physics = createPhysicsState()

    this.renderer = this.buildRenderer()
    this.scene = this.buildScene()
    this.camera = this.buildCamera()
    ;({ platform: this.platform, sphere: this.sphere,
       shadowBlob: this.shadowBlob, trail: this.trail,
       sphereShader: this.sphereShader } = this.buildObjects())

    container.appendChild(this.renderer.domElement)
    this.handleResize()
    window.addEventListener('resize', this.handleResize)
    this.animate()
  }

  setDemo(demo: boolean): void {
    this.isDemo = demo
  }

  /** roll and pitch arrive in degrees (firmware millideg / 1000). Convert to radians for Three.js. */
  updateOrientation(rollDeg: number, pitchDeg: number): void {
    if (this.isDemo) return
    this.platform.rotation.z = rollDeg * (Math.PI / 180)
    this.platform.rotation.x = pitchDeg * (Math.PI / 180)
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.handleResize)
    this.renderer.dispose()
    this.container.removeChild(this.renderer.domElement)
  }

  // ── private ──────────────────────────────────────────────────────────

  private buildRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.setClearColor(0x060608)
    return renderer
  }

  private buildScene(): THREE.Scene {
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x060608, 8, 22)

    const ambient = new THREE.AmbientLight(0x1a1a1e, 1.0)
    scene.add(ambient)

    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(4, 8, 5)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 20
    key.shadow.camera.left = -4
    key.shadow.camera.right = 4
    key.shadow.camera.top = 4
    key.shadow.camera.bottom = -4
    key.shadow.bias = -0.001
    scene.add(key)

    const rim = new THREE.DirectionalLight(0x282830, 0.5)
    rim.position.set(-4, 2, -3)
    scene.add(rim)

    return scene
  }

  private buildCamera(): THREE.PerspectiveCamera {
    const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    cam.position.set(0, 5.5, 7.5)
    cam.lookAt(0, 0.3, 0)
    return cam
  }

  private buildObjects() {
    // Platform
    const platformGeo = new THREE.BoxGeometry(PLATFORM_W, PLATFORM_H, PLATFORM_W, 1, 1, 1)
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x3c4048,
      roughness: 1.0,
      metalness: 0.0,
      envMapIntensity: 0
    })
    const platform = new THREE.Mesh(platformGeo, platformMat)
    platform.receiveShadow = true
    this.scene.add(platform)

    const edgeGeo = new THREE.EdgesGeometry(platformGeo)
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x9aa0aa, linewidth: 1 })
    platform.add(new THREE.LineSegments(edgeGeo, edgeMat))

    // Sphere
    const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 64)
    const sphereShader = createSphereShader()
    const sphere = new THREE.Mesh(sphereGeo, sphereShader.material)
    sphere.position.set(0, SPHERE_Y + DROP_HEIGHT, 0)   // start above, will drop in
    sphere.castShadow = true
    sphere.customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking
    })
    platform.add(sphere)

    // Contact shadow blob
    const blobGeo = new THREE.CircleGeometry(SPHERE_RADIUS * 1.3, 32)
    const blobMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    })
    const shadowBlob = new THREE.Mesh(blobGeo, blobMat)
    shadowBlob.rotation.x = -Math.PI / 2
    shadowBlob.position.set(0, PLATFORM_H / 2 + 0.001, 0)
    platform.add(shadowBlob)

    // Trail
    const trail = new Trail()
    trail.object.position.y = PLATFORM_H / 2 + 0.003
    platform.add(trail.object)

    return { platform, sphere, shadowBlob, trail, sphereShader }
  }

  private readonly handleResize = (): void => {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private animate = (): void => {
    this.raf = requestAnimationFrame(this.animate)

    const dt = Math.min(this.clock.getDelta(), 0.05)
    const elapsed = this.clock.getElapsedTime()

    // Demo tilt
    if (this.isDemo) {
      this.platform.rotation.z = Math.sin(elapsed * DEMO_ROLL_FREQ) * DEMO_ROLL_AMP
      this.platform.rotation.x = Math.sin(elapsed * DEMO_PITCH_FREQ + 0.6) * DEMO_PITCH_AMP
    }

    const rollRad  = this.platform.rotation.z
    const pitchRad = this.platform.rotation.x
    this.onOrientation?.(rollRad, pitchRad)

    this.stateElapsed += dt

    // ── Game state machine ────────────────────────────────────────────
    switch (this.gameState) {

      case 'playing': {
        stepPhysics(this.physics, rollRad, pitchRad, dt)
        const { x, z, vx, vz } = this.physics

        const fellOff = Math.abs(x) > PLATFORM_FALL_THRESHOLD
                     || Math.abs(z) > PLATFORM_FALL_THRESHOLD

        if (fellOff) {
          // Report final survival time, let ball fly off
          this.onStats?.(elapsed - this.survivalStart, false)
          this.lastBallX = x
          this.lastBallZ = z
          this.lastBallVx = vx
          this.lastBallVz = vz
          this.gameState = 'recovering'
          this.stateElapsed = 0
        } else {
          this.sphere.position.set(x, SPHERE_Y, z)
          this.shadowBlob.position.set(x, PLATFORM_H / 2 + 0.001, z)
          this.lastBallX = x
          this.lastBallZ = z
          this.onStats?.(elapsed - this.survivalStart, true)

          // Rolling quaternion accumulation
          const speed = Math.sqrt(vx * vx + vz * vz)
          if (speed > 0.001) {
            const rollAxis = new THREE.Vector3(-vz, 0, vx).normalize()
            const angle = (speed * dt) / SPHERE_RADIUS
            const delta = new THREE.Quaternion().setFromAxisAngle(rollAxis, angle)
            this.sphereQuat.premultiply(delta)
            this.sphere.quaternion.copy(this.sphereQuat)
          }

          this.trail.sample(x, z, 0, elapsed)
        }
        break
      }

      case 'recovering': {
        // Ball flies off the edge and falls downward — no freeze, pure physics
        const t = this.stateElapsed
        const flyX = this.lastBallX + this.lastBallVx * t * 1.4
        const flyZ = this.lastBallZ + this.lastBallVz * t * 1.4
        const flyY = SPHERE_Y - FALL_GRAVITY * t * t
        this.sphere.position.set(flyX, flyY, flyZ)
        this.shadowBlob.visible = false

        if (this.stateElapsed >= RECOVER_DURATION) {
          this.shadowBlob.visible = true
          this.trail.clear()
          this.physics = createPhysicsState()
          this.sphereQuat.identity()
          this.gameState = 'dropping'
          this.stateElapsed = 0
        }
        break
      }

      case 'dropping': {
        // Sphere drops from DROP_HEIGHT above to SPHERE_Y
        const progress = Math.min(this.stateElapsed / DROP_DURATION, 1.0)
        const ease = progress * progress            // quadratic ease-in (accelerating fall)
        const dropY = SPHERE_Y + DROP_HEIGHT * (1 - ease)
        this.sphere.position.set(0, dropY, 0)
        this.shadowBlob.position.set(0, PLATFORM_H / 2 + 0.001, 0)
        // Shadow blob shrinks while ball is high, full size at landing
        const blobScale = 0.3 + 0.7 * ease
        this.shadowBlob.scale.set(blobScale, blobScale, blobScale)

        if (progress >= 1.0) {
          this.sphere.position.set(0, SPHERE_Y, 0)
          this.shadowBlob.scale.set(1, 1, 1)
          // Random initial velocity so the ball rolls on a flat platform
          const kickAngle = Math.random() * Math.PI * 2
          const kickSpeed = 0.8 + Math.random() * 0.6   // 0.8–1.4 m/s
          this.physics.vx = Math.cos(kickAngle) * kickSpeed
          this.physics.vz = Math.sin(kickAngle) * kickSpeed
          this.gameState = 'playing'
          this.stateElapsed = 0
          this.survivalStart = elapsed
        }
        break
      }
    }

    // Shader time
    this.sphereShader.uniforms.uTime.value = elapsed

    // Trail update every frame
    this.trail.update(elapsed)

    this.renderer.render(this.scene, this.camera)
  }
}
