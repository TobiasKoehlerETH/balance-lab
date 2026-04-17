import { SerialPort } from 'serialport'
import { ReadlineParser } from '@serialport/parser-readline'
import { WebContents } from 'electron'
import { parseLine } from './parsing'

const BAUD_RATE = 1_000_000
const RECONNECT_DELAY_MS = 3000
const RAW_LOG_DURATION_MS = 8000   // print raw UART for this many ms after connect
const RAW_LOG_MAX_LINES   = 60     // hard cap so the terminal doesn't flood

export class SerialManager {
  private port: SerialPort | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false
  private lastStatus = false

  constructor(private readonly webContents: WebContents) {}

  start(): void {
    this.connect()
  }

  stop(): void {
    this.destroyed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.port?.close()
  }

  sendTare(): void {
    this.write('gz')
  }

  /** Cancel any pending reconnect timer and attempt connection immediately. */
  connectNow(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.connect()
  }

  private async connect(): Promise<void> {
    if (this.destroyed) return

    let path: string
    try {
      const ports = await SerialPort.list()
      console.log(`[serial] enumerated ${ports.length} port(s):`, ports.map(p => `${p.path} (${p.manufacturer ?? 'unknown'})`).join(', ') || '(none)')
      if (ports.length === 0) {
        this.scheduleReconnect()
        return
      }
      path = ports[0].path
    } catch (err) {
      console.error('[serial] port list error:', err)
      this.scheduleReconnect()
      return
    }

    console.log(`[serial] opening ${path} @ ${BAUD_RATE} baud`)
    const port = new SerialPort({ path, baudRate: BAUD_RATE, autoOpen: false })
    this.port = port

    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }))

    port.open((err) => {
      if (err) {
        console.error(`[serial] open error on ${path}:`, err.message)
        this.emitStatus(false)
        this.scheduleReconnect()
        return
      }
      console.log(`[serial] opened ${path} — sending init commands`)
      this.emitStatus(true)
      this.write('start 104')
      this.write('gz')
    })

    let rawCount = 0
    const rawStart = Date.now()

    parser.on('data', (line: string) => {
      // Log raw UART for the first RAW_LOG_DURATION_MS / RAW_LOG_MAX_LINES
      if (rawCount < RAW_LOG_MAX_LINES && Date.now() - rawStart < RAW_LOG_DURATION_MS) {
        const elapsed = ((Date.now() - rawStart) / 1000).toFixed(3)
        const frame = parseLine(line)
        const parsed = frame ? `→ parsed ok (roll=${frame.roll.toFixed(3)}, pitch=${frame.pitch.toFixed(3)})` : '→ PARSE FAIL'
        console.log(`[serial +${elapsed}s] raw: ${line.trim()}  ${parsed}`)
        rawCount++
        if (rawCount === RAW_LOG_MAX_LINES) console.log('[serial] raw log cap reached — suppressing further raw output')
      }

      const frame = parseLine(line)
      if (frame) {
        this.webContents.send('telemetry', frame)
      }
    })

    port.on('close', () => {
      this.emitStatus(false)
      if (!this.destroyed) this.scheduleReconnect()
    })

    port.on('error', () => {
      this.emitStatus(false)
      if (!this.destroyed) this.scheduleReconnect()
    })
  }

  private write(cmd: string): void {
    if (this.port?.isOpen) {
      this.port.write(`${cmd}\n`)
    }
  }

  /** Re-send the last known status — call this after the renderer finishes loading. */
  resendStatus(): void {
    this.emitStatus(this.lastStatus)
  }

  private emitStatus(connected: boolean): void {
    this.lastStatus = connected
    if (!this.webContents.isDestroyed()) {
      this.webContents.send('status', { connected })
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS)
  }
}
