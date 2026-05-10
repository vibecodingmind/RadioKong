import { useEffect, useState } from 'react'
import { useAppStore } from '../store'

/**
 * Hook for tracking stream uptime and status.
 * Real VU meter and waveform data comes from the Rust audio engine via the
 * useAudioEngine hook (which listens for `vu_meter` and `waveform` IPC messages).
 *
 * Previously this hook generated simulated VU data that overrode real engine
 * data — that simulation has been removed so only actual engine data is used.
 */
export function useStreamStatus() {
  const isStreaming = useAppStore((s) => s.isStreaming)
  const streamStatus = useAppStore((s) => s.streamStatus)

  const [uptime, setUptime] = useState(0)

  // Uptime counter — derived from when the engine reports connected
  useEffect(() => {
    if (!isStreaming) {
      setUptime(0)
      return
    }

    const interval = setInterval(() => {
      setUptime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isStreaming])

  // Update stream status with locally-tracked uptime
  // (The engine reports uptime too, but we keep a local counter for smooth UI)
  useEffect(() => {
    if (isStreaming && streamStatus) {
      useAppStore.getState().setStreamStatus({
        ...streamStatus,
        uptime,
      })
    }
  }, [uptime, isStreaming, streamStatus])

  return {
    isStreaming,
    streamStatus,
    uptime,
  }
}
