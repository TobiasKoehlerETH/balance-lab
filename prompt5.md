# One-Shot Rebuild Prompt

You are rebuilding this desktop software from scratch as a significantly more polished and physically believable version of the same product.

The current app is an Electron desktop app with a React/Vite renderer, Three.js rendering, and serial communication via `serialport`. The tracked source code is not present in this checkout, so you must recreate the app from the observed behavior and hard constraints below.

Your goal is to keep the core concept and the hardware/data contract intact while completely redoing the visual design, UI composition, scene presentation, and the physical behavior of the balancing simulation.

## Product Goal

Recreate the software as a premium, modern balancing simulator/game centered on the same concept:

- A sphere balances and rolls on a tilting platform.
- The platform tilt is driven by the same incoming angle/telemetry logic as the current app.
- The physics should feel much more realistic, grounded, and convincing than the current version.
- The entire interface and look should be redesigned from scratch.
- There is a full game loop: the sphere can slide off the edge, fly off and fall, then drop back from above to restart. A live survival timer counts how long the player has kept the ball on the platform.

## Non-Negotiable Constraints

Keep these behaviors exactly the same unless technically impossible:

### 1. Serial behavior must remain the same

- Auto-connect to the first enumerated serial port.
- Use baud rate `1000000`.
- When the port opens, immediately send:
  - `start 104`
  - `gz`
- Keep the newline-delimited serial protocol.
- Continue to support reconnect behavior on disconnect/error.
- After the renderer finishes loading (`did-finish-load`), re-emit the last known connection status with a 300 ms delay so the React app receives it even if it mounted after the port opened.

### 2. Parsing contract must remain the same

Incoming lines are CSV and may contain `6`, `8`, or `9` numeric fields.

Field mapping:

1. `ax`
2. `ay`
3. `az`
4. `gx`
5. `gy`
6. `gz`
7. optional firmware `roll`
8. optional firmware `pitch`
9. optional `temperatureC`

Scaling rules:

- Accelerometer axes are divided by `1000`
- Gyroscope axes are divided by `1000`
- Firmware `roll` and `pitch` are divided by `1000`
- Temperature is divided by `1000`

Ignore malformed rows the same way a robust streaming parser would.

### 3. Angle/orientation behavior must remain the same

- Preserve the existing angle calculation/orientation semantics.
- If firmware angles are present, use them as the orientation source for `roll` and `pitch`.
- `yaw` must remain hard-clamped to `0`.
- If firmware angles are absent, default orientation to:
  - `roll = 0`
  - `pitch = 0`
  - `yaw = 0`
- Keep the gyroscope tare command behavior the same via `gz`.
- Firmware delivers angles in **millidegrees** (divide by 1000 = degrees). The `updateOrientation` method must convert degrees to radians before applying them to the Three.js platform: `platform.rotation.z = rollDeg * (Math.PI / 180)`, `platform.rotation.x = pitchDeg * (Math.PI / 180)`.

### 4. Keep the same core concept

- Do not change the core interaction into a different game.
- It must still clearly be a sphere-on-platform balancing application.
- Do not replace the platform with a completely different mechanic.

## Where You Should Be Bold

You should fully reinvent these areas:

- The full interface layout
- The visual language
- The color system
- Typography
- Lighting and materials
- Camera feel
- Motion design
- Scene composition
- Physics realism
- Feedback and atmosphere

Do not keep the old HUD/layout/theme. Treat the current look as disposable.

## Visual Direction

Create a premium simulation/lab-grade aesthetic with strong visual hierarchy and depth.

Desired qualities:

- Feels like a professional industrial demo or calibration workstation
- Clean, intentional, high-end, not template-like
- Dramatic but restrained lighting
- Convincing materials for platform and sphere
- Real shadows and contact cues — the sphere must cast a visible shadow on the platform at all times
- Strong sense of weight and friction
- A modern UI that feels purpose-built, not like a generic dashboard

Avoid:

- Flat toy-like visuals
- Arcade-style neon overload
- Placeholder panels
- Generic dark dashboard layouts
- Any sidebar or telemetry rail

A good target would feel like a hybrid of:

- engineering visualization software
- premium product demo
- physical simulation viewer

## Sphere Visual Reference

Take direct inspiration from [WebGLBlobs by Codrops](https://github.com/codrops/WebGLBlobs/) for the sphere's visual treatment. The sphere should feel organic and alive rather than a static polished ball. Key techniques to adopt:

- **Procedural surface deformation**: Use a vertex shader with 3D Perlin/simplex noise to continuously distort the sphere surface along its normals. The deformation should be subtle but persistent — the sphere should appear to softly breathe or pulse as it rolls. Use noise frequency ≈ 1.4 and amplitude ≈ 0.018 so the sphere remains visibly round; too-high values produce a blob.
- **Cosine palette coloring**: Use a fragment shader with cosine-based color interpolation (the `palette(t, a, b, c, d)` formulation) to generate a smooth, shifting color gradient across the sphere surface. Drive the palette input from `vNormal.y * 0.5 + 0.5 + uTime * 0.15` so color varies across the sphere surface and evolves over time. For red: `brightness = vec3(0.55, 0.12, 0.10)`, `contrast = vec3(0.45, 0.12, 0.10)`, `phase = vec3(0.0, 0.38, 0.52)`.
- **Self-emissive glow**: Do not rely purely on Three.js scene lighting for the sphere. Give it a shader-driven emissive quality — a soft inner glow that makes it read even in dark/shadowed conditions.
- **Time-driven animation**: Pass a `uTime` uniform to the sphere's shaders so the surface noise and color shift evolve continuously, giving the sphere life even when stationary.
- **No standard PBR material for the sphere**: Replace `MeshStandardMaterial` with a `ShaderMaterial` that combines noise deformation + cosine coloring + emissive. The platform can remain a standard material; the sphere is the hero and should use custom shaders.
- **Near-black background**: The scene background and overall palette should be very dark (near `#060608`) so the emissive sphere reads clearly against it.
- **Atmospheric grain**: Add a subtle CSS film grain overlay to the canvas for atmospheric texture depth.

## Physics Direction

This is the most important upgrade.

Make the sphere and platform behavior feel substantially more realistic and **challenging**:

- Use a stable fixed-timestep simulation at 120 Hz (`FIXED_DT = 1/120`)
- Model believable gravity response from platform tilt
- Make rolling feel weighty but fast — the ball should build speed quickly and be difficult to stop
- Tune friction, damping, and gravity scale so the ball is genuinely hard to keep centered
- Make acceleration and deceleration feel continuous and physical
- Ensure platform tilt produces plausible motion along both axes
- The sphere must be a child of the platform in the scene graph so it can never clip through the surface regardless of tilt angle
- Avoid jitter, tunneling, and unstable bouncing

**The sphere must leave a visible rolling trail on the platform surface** showing where it has been. The trail should:
- Use `THREE.Points` with `sizeAttenuation: false, size: 4` (screen pixels, not world units) and `AdditiveBlending`
- Fade over `TRAIL_LIFETIME = 1.8` seconds with HDR brightness values so ACES tonemapping renders them bright white
- Extend continuously from oldest visible point all the way to the ball's current position (`TRAIL_SKIP_RECENT = 0`)
- Be cleared when a new round begins

The result should feel like a real sphere on a real tilting surface that is difficult to balance.

### Physics constants (empirically tuned)

```
GRAVITY = 9.81
GRAVITY_SCALE = 4.0        // amplifies tilt-to-acceleration — snappy and hard
FRICTION = 0.990           // velocity multiplier per fixed step (120 Hz)
FIXED_DT = 1 / 120
PLATFORM_W = 5.0           // platform is 5 × 5 world units
PLATFORM_FALL_THRESHOLD = 2.55  // ball exits when |x| or |z| exceeds this
```

### Physics sign convention (critical)

Three.js `rotation.z` (roll): positive = **left** side of platform goes **up** → ball slides in **−X**:
```
accelX = -Math.sin(rollRad) * GRAVITY * GRAVITY_SCALE
```

Three.js `rotation.x` (pitch): positive = **front** (+Z) side goes **down** → ball slides in **+Z**:
```
accelZ = +Math.sin(pitchRad) * GRAVITY * GRAVITY_SCALE
```

Getting these signs wrong makes the ball roll uphill instead of downhill — the most common physics direction bug.

### Game loop: fall-off and respawn

The sphere has **no** boundary restitution. When `Math.abs(x) > PLATFORM_FALL_THRESHOLD || Math.abs(z) > PLATFORM_FALL_THRESHOLD`, a 3-state game machine runs:

**`playing` → `recovering` → `dropping` → `playing`**

**`recovering`** (0.75 s): The ball continues outward with 1.4× its current XZ velocity and simultaneously falls in the local Y direction under `FALL_GRAVITY = 12.0` (quadratic). The contact shadow blob is hidden. After 0.75 s the ball is well out of view below the platform.

**`dropping`** (0.55 s): The ball is repositioned to `(0, SPHERE_Y + DROP_HEIGHT, 0)` (platform-local) and falls toward the centre using a quadratic ease-in. The shadow blob reappears and scales from 0.3 to 1.0 as the ball approaches, providing a depth cue. On landing:
- Give the ball a **random initial velocity** of 0.8–1.4 m/s in a random direction so it rolls immediately even on a flat platform.
- Record `survivalStart = elapsed`.
- Transition to `playing`.

**`playing`**: Normal physics step. Report `onStats(elapsed - survivalStart, true)` every frame. On fall-off, report `onStats(finalTime, false)` then enter `recovering`.

### Rolling visual

Use quaternion accumulation each frame so multi-axis rolling composes correctly:
```
rollAxis = normalize(-vz, 0, vx)
angle = speed * dt / SPHERE_RADIUS
deltaQuat = Quaternion.fromAxisAngle(rollAxis, angle)
sphereQuat.premultiply(deltaQuat)
sphere.quaternion.copy(sphereQuat)
```
Reset `sphereQuat` to identity on each new round.

## UX Requirements

**The 3D simulation view is the entire interface.** There is no sidebar, no telemetry panel, no raw sensor readout.

### Top bar

A single minimal top bar (`height: 40px`) floats over the scene at the top. It has two clusters separated by a flex spacer:

**Left cluster** (in order):
1. `DEMO` badge — visible only when no sensor is connected
2. Roll angle (`R +12.3°`) — monospace, tabular-nums
3. Pitch angle (`P −4.5°`) — monospace, tabular-nums
4. Thin divider
5. Connection status dot (pulsing green when connected, dim grey when not)
6. Connect sensor button (plug icon) — visible only when **not** connected; calls `connectSensor()` on click
7. Tare gyroscope button (crosshair/target icon) — always visible; calls `tareGyroscope()` on click

**Right cluster**:
8. Window controls — three circles (macOS-style): minimize (yellow `#febc2e`), maximize (green `#28c840`), close (red `#ff5f57`). Each calls its respective window IPC handler.

The top bar uses `-webkit-app-region: drag` so it functions as an Electron drag handle. All interactive children must override with `-webkit-app-region: no-drag`.

### Survival timer overlay

A large live timer is displayed at the **top centre of the canvas** (not inside the top bar):

- `position: fixed; top: 52px; left: 50%; transform: translateX(-50%)`
- Font size `72px`, `font-weight: 100`, monospace, `tabular-nums`
- Colour `rgba(255,255,255,0.82)` with a subtle red text-shadow glow
- Shows `"12.3s"` format while the ball is `playing`; hidden during `recovering` and `dropping` states

### High-score leaderboard

A top-3 leaderboard is displayed at the **top left**, below the top bar:

- `position: fixed; top: 56px; left: 18px`
- A dim `"BEST"` label in small caps above the rows
- Each row: dim `#1`/`#2`/`#3` rank label + `24px font-weight:200` score in monospace
- The **#1 (best) row is always rendered in gold** (`color: #f0c040`, subtle gold glow)
- `#2` and `#3` rows render in dim grey (`#888894`)
- When a new score enters the top 3, that row pulses with a 4-second animation (opacity flicker × 4)
- The leaderboard is hidden until at least one round has been completed
- Scores are stored in React state (in-memory; reset on app restart is acceptable)

### Demo mode

When no sensor is connected (`isDemo = true`), the platform animates with a Lissajous-style tilt:
```
rotation.z = sin(elapsed × 0.65) × 0.22
rotation.x = sin(elapsed × 1.05 + 0.6) × 0.22
```
A small `DEMO` badge is shown in the top bar. A dim status line `"NO SENSOR"` appears at the bottom centre of the window. No blocking error overlays.

### IPC / preload bridge

Expose the following methods on `window.balanceLab`:

```ts
onTelemetry(cb: (frame: TelemetryFrame) => void): () => void
onStatus(cb: (s: { connected: boolean }) => void): () => void
tareGyroscope(): void
connectSensor(): void       // triggers immediate reconnect attempt
minimizeWindow(): void
maximizeWindow(): void      // toggles maximize/unmaximize
closeWindow(): void
```

## Reference Examples

The directory containing this prompt also has an `example/` folder with two reference implementations you should study before writing any code:

- **`example/Interactive-rolling-sphere/index.html`** — a single-file Three.js demo showing rolling-without-sliding physics, spring-based mouse drag, and procedural stripe texture.
- **`example/baller/`** — a Webpack/Three.js game with physics via Ammo.js in a Web Worker.

These examples are local and do not require network access. Use them as concrete implementation references for rolling physics and Three.js scene patterns — not as code to copy wholesale.

## Technical Guidance

Preferred implementation stack:

- Electron
- React
- Vite (electron-vite 2.x)
- Three.js
- `serialport` v12 + `@serialport/parser-readline` for hardware comms
- **No Rapier / no physics engine** — implement a custom fixed-timestep physics loop directly (≈ 40 lines of pure math, sufficient for this use case)

The app should remain desktop-first and production-runnable.

## Important Clarification

There is a mismatch between the README and the built app regarding the startup command rate. The built app behavior is authoritative for this rebuild:

- use `start 104`

not `start 100`.

## Delivery Expectations

Produce a complete working rebuild, not a mockup.

Deliver:

- full project bootstrap from an empty or minimal checkout
- installable dependencies and correct package configuration
- Electron/Vite/React wiring that can actually run locally
- the Electron main-process serial pipeline
- preload bridge with all methods listed above
- renderer application
- realistic platform/sphere simulation with rolling trail and sphere shadow
- redesigned UI with no sidebar
- game loop: fall-off detection, fly-off animation, drop-from-above respawn, survival timer, top-3 leaderboard
- sensible project structure
- all scripts needed for development, build, lint/typecheck, and test
- enough comments only where the code is not self-explanatory

Keep the implementation simple where possible. Do not add speculative features or configurability that was not requested.

## Setup Requirements

Do not assume the project is already correctly scaffolded. Include everything needed so a developer can clone the project, install dependencies, run it, and build it.

That means the rebuild should include:

- a complete `package.json`
- all required dependencies and devDependencies
- Vite configuration
- Electron main/preload wiring
- TypeScript configuration if TypeScript is used
- any required asset loading and path handling
- a clear source tree
- working npm scripts

At minimum, the finished software should support commands equivalent to:

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run lint`

## Testing And Verification Requirements

Do not stop after writing code. The rebuild must include verification steps and executable tests appropriate for the project.

Add:

- focused tests for the serial parsing contract
- tests for the preserved orientation behavior
- tests for any critical pure logic extracted for the simulation or telemetry pipeline
- a final run verification that confirms the app actually launches

Tests should directly validate the preserved constraints:

- `6`, `8`, and `9` field CSV frames
- `/1000` scaling behavior
- firmware-angle handling
- `yaw = 0`
- sane fallback behavior for malformed data

## Mandatory End-Of-Task Agent Workflow

At the end of the implementation, you must use subagents for final execution and stabilization.

Required workflow:

1. **Interactive preview first** — Before launching the full Electron app, run `vite build` followed by `vite preview` (or equivalent) to start a browser-accessible preview server. Open the preview using the available preview/browser tool so you can interact with it and capture screenshots. This validates the renderer in isolation before wrapping it in Electron.
2. **Screenshot-driven visual debug loop** — Take a screenshot of the running preview immediately after it starts. Inspect it for: blank canvas, shader compile errors, invisible sphere, missing trail, wrong colors, broken layout, physics direction (ball must roll downhill). Fix any visual defects found, rebuild, and take another screenshot. Repeat until the preview renders correctly. Do not proceed to Electron launch if the renderer is visually broken.
3. **Spawn a subagent to launch the full Electron app** — its only job is to start the app and report exactly what happens (errors, warnings, window appearance).
4. **Spawn a second subagent to fix launch/runtime errors** — owns stabilization work.
5. **Spawn a third subagent for final design review** — uses the screenshot tool to inspect the running app, comments on layout, composition, readability, hierarchy, materials, lighting, motion feel, and overall polish.
6. Repeat the launch-and-debug cycle until no blocking errors remain.
7. After the app launches, address any high-impact visual/design problems the design-review subagent identifies.

Rules for this workflow:

- The preview step is mandatory — do not skip directly to Electron.
- Screenshot inspection must happen at the preview stage AND after Electron launch. Never rely solely on reading code to judge visual quality.
- The launch subagent should focus on running the software, not editing code unless absolutely necessary.
- The debug subagent should own bug fixing and stabilization work.
- Keep iterating until the app launches cleanly or you hit a truly external blocker.
- Keep iterating visually until there are no obvious high-impact design problems that undermine the requested premium look.
- If there is an external blocker, state it explicitly and distinguish it from code defects.
- Do not claim completion before this workflow is done.

The final result should be a rebuilt application that is not only implemented, but also actually launched, debugged into a runnable state, visually inspected from screenshots, and reviewed for design quality.

## Acceptance Checklist

The rebuild is successful only if all of the following are true:

- The app still reads the same serial data format.
- The app still opens the first serial port at `1000000` baud.
- The app still sends `start 104` and `gz` on connect.
- Roll and pitch still follow the same angle semantics as the current app.
- Firmware millidegrees are correctly converted to radians for Three.js.
- Physics direction is correct: ball rolls toward the low side of the tilted platform (not uphill).
- Yaw is still fixed to `0`.
- The tare behavior still works (icon button, no label).
- `connectSensor()` triggers an immediate reconnect attempt.
- Window controls (minimize / maximize / close) are in the **top-right** of the top bar.
- All status/game controls are in the **top-left** of the top bar.
- The survival timer displays in large font at the top centre of the canvas, not in the top bar.
- The top-3 leaderboard is visible in the top-left of the canvas after the first round ends.
- The #1 leaderboard entry is always highlighted in gold.
- A new top-3 entry pulses to draw attention when it is set.
- The ball slides off the platform edge, flies outward and falls below the surface, then drops from above to respawn.
- The respawning ball has a random initial velocity so it moves immediately on a flat platform.
- The contact shadow blob is hidden while the ball is falling off and visible/scaled during the drop-in.
- The repository includes everything needed to install, run, build, lint, and test the software.
- Automated tests cover the preserved telemetry/orientation contract.
- An interactive preview (browser) was opened and inspected via screenshot before Electron launch.
- A subagent has launched the full Electron app and another subagent has debugged issues until no blocking errors remain.
- A separate subagent has inspected screenshots of the running app and completed a design review.
- Any major visual/design issues found in that review have been addressed or explicitly documented as external blockers.
- The software still clearly centers on balancing a sphere on a platform.
- The physics feel materially more realistic and **difficult** than before — the ball builds speed fast.
- The UI and visual design are completely refreshed with no sidebar.
- The sphere never clips through the platform regardless of tilt angle.
- The sphere casts a visible shadow on the platform.
- The rolling trail extends from the oldest visible point all the way to the ball's current position (no gap).
- Demo mode runs automatically when no sensor is connected.
- The simulation view fills the entire window — no panels, rails, or overlays divide it.

## Color Theme

The required visual theme is **black, white, and red**:

- **Background**: near-black (`#060608`).
- **Platform**: matte grey / subtle metallic slate. `roughness: 1.0, metalness: 0.0`. Use `envMapIntensity: 0` to prevent environment map from tinting it blue. Base color `#3c4048`.
- **Sphere**: **red**, produced by the cosine palette shader (see Sphere Visual Reference section).
- **Trail**: white or near-white. Use HDR values (> 1.0) in the vertex color buffer so ACES filmic tone mapping renders them bright on the dark background.
- **UI chrome**: white/grey text. The only color accent is the red sphere and the gold #1 leaderboard entry.
- **Fog**: match the near-black background color.
- **Lighting**: key light `0xffffff` at intensity 1.1, position (4, 8, 5). Rim light `0x282830`. Ambient `0x1a1a1e`. `renderer.toneMapping = THREE.ACESFilmicToneMapping`.

Do not use blue, teal, or any colored tint on the platform or UI chrome.

### Scene graph

- **The sphere must be a child of the platform mesh**, not the scene root. This is the only way to guarantee the sphere never clips through the tilted platform — it inherits the platform's tilt automatically and its local Y position stays constant.
- Contact blob shadow and trail points should also be children of the platform for the same reason.

### Sphere shader (WebGLBlobs)

- Replace `MeshStandardMaterial` on the sphere with a `ShaderMaterial` using codrops WebGLBlobs-style vertex + fragment shaders.
- The vertex shader uses periodic 3D Perlin noise (`pnoise`) — inline the noise functions since `glslify` is not available in a Vite project.
- The fragment shader uses the cosine palette function: `a + b * cos(6.28318 * (c * t + d))`.
- Set `sphere.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })` so the shadow depth pass uses the undeformed sphere geometry.
- The `uTime` uniform must be updated every animation frame (`sphereUniforms.uTime.value = elapsed`).

### Trail rendering

- `THREE.Line` is always 1 px wide in WebGL. Use `THREE.Points` (`PointsMaterial`) instead.
- `sizeAttenuation: false, size: 4` — size in screen pixels, not world units. **Critical**: `sizeAttenuation: true` with `size: 5` projects to hundreds of world-space pixels and renders as a white blob covering the scene.
- Use `depthWrite: false, transparent: true, blending: THREE.AdditiveBlending`.
- Trail positions are in platform-local space.
- `TRAIL_SKIP_RECENT = 0` — trail extends all the way to the ball's current position.

### Physics integration model

Strict accumulation chain inside fixed timestep:

1. Compute tilt-driven acceleration: `accelX = -sin(rollRad) × g × GRAVITY_SCALE`, `accelZ = +sin(pitchRad) × g × GRAVITY_SCALE`
2. Integrate velocity: `vx += accelX × FIXED_DT`
3. Apply friction: `vx *= FRICTION`
4. Integrate position: `x += vx × FIXED_DT`
5. Check boundary (`|x| > PLATFORM_FALL_THRESHOLD || |z| > PLATFORM_FALL_THRESHOLD`) — if exceeded, enter `recovering` state

No boundary clamping or restitution — the ball falls off freely.

### Preview / build workflow

- The `vite preview` server serves the pre-built `dist/` — you must run `vite build` before restarting the preview server to see code changes.
- `UnknownVizError` from `preview_screenshot` usually resolves by waiting 2–3 seconds after server start for WebGL to initialize.
- **Always take a screenshot immediately after the preview server starts.** Use it to confirm: canvas is visible, sphere renders red, trail is present, top bar is readable, window controls are top-right, leaderboard is top-left.
- If the screenshot shows a blank or broken canvas, check the browser console for WebGL errors or shader compilation failures before editing code.
- Verify physics direction by watching the demo: with R > 0° the ball should roll left; with P > 0° the ball should roll toward the camera.

## Execution Style

Do not ask for permission to make the redesign bold. Make strong design decisions.

Do not preserve the existing interface out of caution.

Do preserve the serial protocol and angle behavior exactly.

Rebuild the experience so it feels like the same product concept evolved into a much more serious, visually compelling, and physically believable application.
