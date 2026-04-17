import React from 'react'

interface Props {
  roll: number
  pitch: number
  connected: boolean
  onTare: () => void
  onConnect: () => void
  onMinimize: () => void
  onMaximize: () => void
  onClose: () => void
}

function fmt(deg: number): string {
  const sign = deg >= 0 ? '+' : ''
  return `${sign}${deg.toFixed(1)}°`
}

function SignalIcon({ connected }: { connected: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3.5" fill={connected ? '#3ddc68' : '#555560'} />
      {connected && (
        <circle cx="8" cy="8" r="3.5" fill="#3ddc68" opacity="0.3">
          <animate attributeName="r" from="3.5" to="7" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.3" to="0" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  )
}

function TareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="5.5" />
      <line x1="8" y1="2.5" x2="8" y2="4.5" />
      <line x1="8" y1="11.5" x2="8" y2="13.5" />
      <line x1="2.5" y1="8" x2="4.5" y2="8" />
      <line x1="11.5" y1="8" x2="13.5" y2="8" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ConnectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      {/* plug body */}
      <rect x="5" y="7" width="6" height="5" rx="1" />
      {/* prongs */}
      <line x1="6.5" y1="5" x2="6.5" y2="7" />
      <line x1="9.5" y1="5" x2="9.5" y2="7" />
      {/* cable */}
      <line x1="8" y1="12" x2="8" y2="14" />
    </svg>
  )
}

export default function TopBar({ roll, pitch, connected, onTare, onConnect, onMinimize, onMaximize, onClose }: Props) {
  return (
    <div className="top-bar">
      {/* Left cluster: status + controls */}
      <span className="angle-value" title="Roll">
        <span className="angle-label">R</span>
        {fmt(roll)}
      </span>
      <span className="angle-value" title="Pitch">
        <span className="angle-label">P</span>
        {fmt(pitch)}
      </span>

      <div className="top-bar-divider" />

      <div className="signal-icon" title={connected ? 'Connected' : 'Disconnected'}>
        <SignalIcon connected={connected} />
      </div>

      {!connected && (
        <button className="tare-btn connect-btn" onClick={onConnect} title="Connect sensor">
          <ConnectIcon />
        </button>
      )}

      <button className="tare-btn" onClick={onTare} title="Tare gyroscope">
        <TareIcon />
      </button>

      <div className="top-bar-spacer" />

      {/* Right cluster: window controls */}
      <div className="window-controls">
        <button className="wc-btn wc-min"    onClick={onMinimize} title="Minimize">
          <svg width="8" height="8" viewBox="0 0 8 8"><line x1="1" y1="4" x2="7" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        <button className="wc-btn wc-max"    onClick={onMaximize} title="Maximize">
          <svg width="8" height="8" viewBox="0 0 8 8"><rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
        </button>
        <button className="wc-btn wc-close"  onClick={onClose}    title="Close">
          <svg width="8" height="8" viewBox="0 0 8 8"><line x1="1" y1="1" x2="7" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="1" x2="1" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
    </div>
  )
}
