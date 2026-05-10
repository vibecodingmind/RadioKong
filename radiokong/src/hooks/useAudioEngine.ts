import { useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../store'
import type { EngineMessage, VUMeterData, StreamStatus } from '../types'

/**
 * Hook to communicate with the Rust audio engine via Electron IPC.
 * Handles engine messages, VU meter updates, stream status, and error handling.
 */
export function useAudioEngine() {
  const setVUMeters = useAppStore((s) => s.setVUMeters)
  const setStreamStatus = useAppStore((s) => s.setStreamStatus)
  const setStreaming = useAppStore((s) => s.setStreaming)
  const setConnecting = useAppStore((s) => s.setConnecting)
  const setAudioDevices = useAppStore((s) => s.setAudioDevices)
  const updateChannel = useAppStore((s) => s.updateChannel)
  const vuMetersRef = useRef<VUMeterData | null>(null)

  // Handle incoming engine messages
  const handleEngineMessage = useCallback(
    (message: EngineMessage) => {
      switch (message.type) {
        case 'vu_meter': {
          const vuData = message.data as VUMeterData
          setVUMeters(vuData)
          vuMetersRef.current = vuData

          // Update individual channel VU levels
          if (vuData.channels) {
            const channels = useAppStore.getState().mixerChannels
            vuData.channels.forEach((vuCh, index) => {
              if (index < channels.length) {
                updateChannel(channels[index].id, {
                  vuLevel: {
                    left: vuCh.left,
                    right: vuCh.right,
                  },
                })
              }
            })
          }
          break
        }

        case 'stream_status': {
          const status = message.data as StreamStatus
          setStreamStatus(status)
          setStreaming(status.connected)
          setConnecting(false)
          break
        }

        case 'error': {
          console.error('[Engine Error]', message.data)
          setConnecting(false)
          setStreaming(false)
          break
        }

        case 'devices': {
          const devices = message.data as any[]
          setAudioDevices(devices)
          break
        }

        case 'status': {
          console.log('[Engine Status]', message.data)
          break
        }

        default:
          console.log('[Engine] Unknown message type:', message.type)
      }
    },
    [setVUMeters, setStreamStatus, setStreaming, setConnecting, setAudioDevices, updateChannel]
  )

  // Register message listener
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onEngineMessage(handleEngineMessage)

      // Request device list on mount
      window.electronAPI.engineCommand({ type: 'list_devices' })
    }
  }, [handleEngineMessage])

  // Start streaming
  const startStream = useCallback(async () => {
    if (!window.electronAPI) {
      console.warn('[Engine] Electron API not available')
      return
    }

    setConnecting(true)
    try {
      const config = useAppStore.getState().getEngineConfig()
      await window.electronAPI.engineStart(config)
    } catch (err) {
      console.error('[Engine] Failed to start:', err)
      setConnecting(false)
    }
  }, [setConnecting])

  // Stop streaming
  const stopStream = useCallback(async () => {
    if (!window.electronAPI) return

    try {
      await window.electronAPI.engineStop()
      setStreaming(false)
      setStreamStatus(null)
    } catch (err) {
      console.error('[Engine] Failed to stop:', err)
    }
  }, [setStreaming, setStreamStatus])

  // Send command to engine
  const sendCommand = useCallback(async (command: any) => {
    if (!window.electronAPI) return
    try {
      await window.electronAPI.engineCommand(command)
    } catch (err) {
      console.error('[Engine] Command failed:', err)
    }
  }, [])

  return {
    startStream,
    stopStream,
    sendCommand,
  }
}
