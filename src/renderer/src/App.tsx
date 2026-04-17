import React, { useEffect, useRef, useState } from 'react'
import { SceneManager } from './simulation/SceneManager'
import TopBar from './components/TopBar'

const RAD_TO_DEG = 180 / Math.PI
const MAX_SCORES = 3

const FALL_MESSAGES = [
  'Gravity: 1, You: 0',
  'Skill issue.',
  'The ball has left the chat.',
  'Newton would be disappointed.',
  'Catastrophic failure.',
  'The floor was lava.',
  'Gone.',
  'Edge: 1, Ball: 0',
  'Rip.',
  'The ball has achieved freedom.',
  'That escalated quickly.',
  'Oops.',
  'Loading next excuse…',
  'Perfectly balanced.',
  'The platform misses you already.',
  'See you on the flip side.',
]

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<SceneManager | null>(null)

  const [roll, setRoll] = useState(0)
  const [pitch, setPitch] = useState(0)
  const [connected, setConnected] = useState(false)
  const [survivalSeconds, setSurvivalSeconds] = useState<number | null>(null)
  const [frozenTime, setFrozenTime] = useState<number | null>(null)
  const [highScores, setHighScores] = useState<number[]>([])
  const [newScoreIndex, setNewScoreIndex] = useState<number | null>(null)
  const [fallMessage, setFallMessage] = useState<{ text: string; id: number } | null>(null)
  const fallIdRef = useRef(0)

  // Keep a ref so the onStats closure always sees fresh scores
  const highScoresRef = useRef<number[]>([])

  // Boot scene
  useEffect(() => {
    if (!containerRef.current) return
    const sm = new SceneManager(containerRef.current)

    sm.onOrientation = (r, p) => {
      setRoll(r * RAD_TO_DEG)
      setPitch(p * RAD_TO_DEG)
    }

    sm.onStats = (seconds, isPlaying) => {
      setSurvivalSeconds(isPlaying ? seconds : null)

      if (isPlaying) {
        // New round started — clear recovery UI
        setFrozenTime(null)
        setFallMessage(null)
      }

      if (!isPlaying && seconds > 0) {
        // Freeze the final time so it stays visible during recovery
        setFrozenTime(seconds)

        // Update leaderboard
        const prev = highScoresRef.current
        const next = [...prev, seconds].sort((a, b) => b - a).slice(0, MAX_SCORES)
        const idx = next.indexOf(seconds)
        const isTopEntry = idx !== -1 && (prev.length < MAX_SCORES || seconds > prev[prev.length - 1])

        highScoresRef.current = next
        setHighScores([...next])

        if (isTopEntry) {
          // High score — show congrats banner only, no funny message
          setNewScoreIndex(idx)
          setTimeout(() => setNewScoreIndex(null), 4000)
        } else {
          // Not a high score — show a random funny message
          const msg = FALL_MESSAGES[Math.floor(Math.random() * FALL_MESSAGES.length)]
          fallIdRef.current += 1
          setFallMessage({ text: msg, id: fallIdRef.current })
        }
      }
    }

    sceneRef.current = sm
    return () => sm.dispose()
  }, [])

  // Wire hardware bridge when present
  useEffect(() => {
    const api = window.balanceLab
    if (!api) return

    const offTelemetry = api.onTelemetry((frame) => {
      sceneRef.current?.updateOrientation(frame.roll, frame.pitch)
    })

    const offStatus = api.onStatus(({ connected: c }) => {
      setConnected(c)
      sceneRef.current?.setDemo(!c)
    })

    return () => {
      offTelemetry()
      offStatus()
    }
  }, [])

  const api = window.balanceLab
  const isDemo = !connected

  // What to show in the timer slot: live time while playing, frozen time during recovery
  const displayTime = survivalSeconds ?? frozenTime

  return (
    <div className="app-root">
      <TopBar
        roll={roll}
        pitch={pitch}
        connected={connected}
        onTare={() => api?.tareGyroscope()}
        onConnect={() => api?.connectSensor()}
        onMinimize={() => api?.minimizeWindow()}
        onMaximize={() => api?.maximizeWindow()}
        onClose={() => api?.closeWindow()}
      />
      <div ref={containerRef} className="scene-container" />
      <div className="grain-overlay" />

      {/* Timer slot: live counter while playing, frozen final time during recovery */}
      {displayTime !== null && (
        <div className="survival-timer">{displayTime.toFixed(1)}s</div>
      )}

      {/* Congratulations banner for top-3 entries — replaces the funny message */}
      {newScoreIndex !== null && (
        <div key={`congrats-${newScoreIndex}`} className="congrats-banner">
          <div className="congrats-ring" />
          <div className="congrats-ring congrats-ring--delay" />
          <div className="congrats-main">
            {newScoreIndex === 0 ? 'NEW BEST!' : newScoreIndex === 1 ? 'TOP 2!' : 'TOP 3!'}
          </div>
          <div className="congrats-sub">
            {newScoreIndex === 0 ? 'Outstanding.' : newScoreIndex === 1 ? 'Almost perfect.' : 'Podium finish.'}
          </div>
        </div>
      )}

      {/* Funny fall message — only when not a high score */}
      {fallMessage && newScoreIndex === null && (
        <div key={fallMessage.id} className="fall-message">{fallMessage.text}</div>
      )}

      {/* High-score leaderboard */}
      {highScores.length > 0 && (
        <div className="leaderboard">
          <div className="leaderboard-title">BEST</div>
          {highScores.map((s, i) => (
            <div
              key={i}
              className={[
                'leaderboard-row',
                i === 0 ? 'leaderboard-row--gold' : '',
                i === newScoreIndex ? 'leaderboard-row--new' : '',
              ].filter(Boolean).join(' ')}
            >
              <span className="leaderboard-rank">#{i + 1}</span>
              <span className="leaderboard-score">{s.toFixed(1)}s</span>
            </div>
          ))}
        </div>
      )}

      {isDemo && (
        <div className="status-line">No sensor</div>
      )}
    </div>
  )
}
