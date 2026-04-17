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

export interface BalanceLabAPI {
  onTelemetry: (cb: (frame: TelemetryFrame) => void) => () => void
  onStatus: (cb: (status: { connected: boolean }) => void) => () => void
  tareGyroscope: () => void
  connectSensor: () => void
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
}

declare global {
  interface Window {
    balanceLab?: BalanceLabAPI
  }
}
