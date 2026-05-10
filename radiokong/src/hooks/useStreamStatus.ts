import { useEffect, useState } from 'react'
import { useAppStore } from '../store'

/**
 * Hook to simulate VU meter data for UI development when the engine is not connected.
 * In production, this data comes from the Rust audio engine via IPC.
 */
export function useStreamStatus() {
  const isStreaming = useAppStore((s) => s.isStreaming)
  const streamStatus = useAppStore((s) => s.streamStatus)
  const updateChannel = useAppStore((s) => s.updateChannel)

  const [uptime, setUptime] = useState(0)

  // Simulate VU meter movement when streaming (for demo purposes)
  useEffect(() => {
    if (!isStreaming) return

    const interval = setInterval(() => {
      const channels = useAppStore.getState().mixerChannels
      channels.forEach((ch) => {
        if (!ch.muted) {
          const baseLevel = ch.volume * 0.6
          const variation = Math.random() * 0.3
          const level = baseLevel + variation
          updateChannel(ch.id, {
            vuLevel: {
              left: Math.min(level + (Math.random() - 0.5) * 0.1, 1),
              right: Math.min(level + (Math.random() - 0.5) * 0.1, 1),
            },
          })
        } else {
          updateChannel(ch.id, {
            vuLevel: { left: 0, right: 0 },
          })
        }
      })
    }, 100)

    return () => clearInterval(interval)
  }, [isStreaming, updateChannel])

  // Uptime counter
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

  // Update stream status with uptime
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
