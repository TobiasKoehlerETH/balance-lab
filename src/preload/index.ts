import { contextBridge, ipcRenderer } from 'electron'
import type { TelemetryFrame } from '../main/parsing'

contextBridge.exposeInMainWorld('balanceLab', {
  onTelemetry: (cb: (frame: TelemetryFrame) => void): (() => void) => {
    const handler = (_: unknown, frame: TelemetryFrame): void => cb(frame)
    ipcRenderer.on('telemetry', handler)
    return () => ipcRenderer.removeListener('telemetry', handler)
  },
  onStatus: (cb: (status: { connected: boolean }) => void): (() => void) => {
    const handler = (_: unknown, status: { connected: boolean }): void => cb(status)
    ipcRenderer.on('status', handler)
    return () => ipcRenderer.removeListener('status', handler)
  },
  tareGyroscope: (): void => { ipcRenderer.invoke('tare') },
  connectSensor: (): void => { ipcRenderer.invoke('connect') },
  minimizeWindow: (): void => { ipcRenderer.invoke('window:minimize') },
  maximizeWindow: (): void => { ipcRenderer.invoke('window:maximize') },
  closeWindow: (): void => { ipcRenderer.invoke('window:close') }
})
