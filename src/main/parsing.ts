export interface TelemetryFrame {
  ax: number
  ay: number
  az: number
  gx: number
  gy: number
  gz: number
  roll: number
  pitch: number
  yaw: number
  temperatureC?: number
}

export function parseLine(line: string): TelemetryFrame | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const parts = trimmed.split(',')
  const n = parts.length
  if (n !== 6 && n !== 8 && n !== 9) return null

  const nums = parts.map(Number)
  if (nums.some((v) => isNaN(v))) return null

  const ax = nums[0] / 1000
  const ay = nums[1] / 1000
  const az = nums[2] / 1000
  const gx = nums[3] / 1000
  const gy = nums[4] / 1000
  const gz = nums[5] / 1000

  let roll = 0
  let pitch = 0
  let temperatureC: number | undefined

  if (n >= 8) {
    roll = nums[6] / 1000
    pitch = nums[7] / 1000
  }

  if (n === 9) {
    temperatureC = nums[8] / 1000
  }

  return { ax, ay, az, gx, gy, gz, roll, pitch, yaw: 0, temperatureC }
}
