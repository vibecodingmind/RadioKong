import { useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../store'
import { useSubscriptionStore, hasFeature } from '../store/subscription'
import type { EngineMessage, VUMeterData, StreamStatus, TestConnectionResult, ConfigResult, RecordingStoppedData } from '../types'

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_INTERVAL_MS = 5000

/**
 * Hook to communicate with the Rust audio engine via Electron IPC.
 * Handles engine messages, VU meter updates, stream status, auto-reconnect, and error handling.
 */
export function useAudioEngine() {
  const setVUMeters = useAppStore((s) => s.setVUMeters)
  const setStreamStatus = useAppStore((s) => s.setStreamStatus)
  const setStreaming = useAppStore((s) => s.setStreaming)
  const setConnecting = useAppStore((s) => s.setConnecting)
  const setAudioDevices = useAppStore((s) => s.setAudioDevices)
  const updateChannel = useAppStore((s) => s.updateChannel)
  const setWaveformData = useAppStore((s) => s.setWaveformData)
  const addRecording = useAppStore((s) => s.addRecording)
  const setRecording = useAppStore((s) => s.setRecording)
  const setTestConnectionResult = useAppStore((s) => s.setTestConnectionResult)
  const setTestingConnection = useAppStore((s) => s.setTestingConnection)
  const setLastConfigSavePath = useAppStore((s) => s.setLastConfigSavePath)
  const vuMetersRef = useRef<VUMeterData | null>(null)

  // Auto-reconnect state
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const wasStreamingRef = useRef(false)
  const isManualStopRef = useRef(false)

  // Auto-reconnect logic
  const attemptReconnect = useCallback(async () => {
    const tier = useSubscriptionStore.getState().tier
    const canAutoReconnect = hasFeature(tier, 'autoReconnect')

    if (!canAutoReconnect) {
      console.log('[Auto-Reconnect] Not available on free tier')
      return
    }

    if (isManualStopRef.current) {
      console.log('[Auto-Reconnect] Stream was manually stopped, skipping reconnect')
      return
    }

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log(`[Auto-Reconnect] Max attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`)
      useAppStore.getState().setStreaming(false)
      useAppStore.getState().setStreamStatus(null)
      return
    }

    reconnectAttemptsRef.current++
    console.log(
      `[Auto-Reconnect] Attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_INTERVAL_MS / 1000}s...`
    )

    reconnectTimerRef.current = setTimeout(async () => {
      const state = useAppStore.getState()
      if (!state.isStreaming && wasStreamingRef.current && !isManualStopRef.current) {
        try {
          state.setConnecting(true)
          const config = state.getEngineConfig()
          await window.electronAPI?.engineStart(config)
          console.log('[Auto-Reconnect] Reconnection attempt sent')
        } catch (err) {
          console.error('[Auto-Reconnect] Failed:', err)
          // Retry again
          attemptReconnect()
        }
      }
    }, RECONNECT_INTERVAL_MS)
  }, [])

  // Handle incoming engine messages
  const handleEngineMessage = useCallback(
    (message: EngineMessage) => {
      switch (message.type) {
        case 'vu_meter': {
          const vuData = message.data as unknown as VUMeterData
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
          const status = message.data as unknown as StreamStatus
          setStreamStatus(status)
          setStreaming(status.connected)
          setConnecting(false)

          if (status.connected) {
            // Reset reconnect counter on successful connection
            reconnectAttemptsRef.current = 0
            wasStreamingRef.current = true
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current)
              reconnectTimerRef.current = null
            }
          }
          break
        }

        case 'error': {
          console.error('[Engine Error]', message.data)
          setConnecting(false)

          const errorMessage = message.data as Record<string, unknown>
          const errorStr = (errorMessage.message as string || '').toLowerCase()
          const isConnectionError =
            errorStr.includes('disconnect') ||
            errorStr.includes('connection') ||
            errorStr.includes('timeout') ||
            errorStr.includes('reset') ||
            errorStr.includes('refused') ||
            errorStr.includes('broken pipe')

          if (isConnectionError && wasStreamingRef.current && !isManualStopRef.current) {
            // Connection dropped — try to reconnect
            setStreaming(false)
            attemptReconnect()
          } else {
            setStreaming(false)
          }
          break
        }

        case 'devices': {
          const devices = message.data as unknown as any[]
          setAudioDevices(devices)
          break
        }

        case 'waveform': {
          const waveData = message.data as Record<string, unknown>
          const samples = waveData.samples as number[] | undefined
          setWaveformData(samples || null)
          break
        }

        case 'test_connection_result': {
          const result = message.data as unknown as TestConnectionResult
          setTestConnectionResult(result)
          setTestingConnection(false)
          break
        }

        case 'config_result': {
          const configResult = message.data as unknown as ConfigResult
          if (configResult.success && configResult.config) {
            // Apply loaded config to store
            const store = useAppStore.getState()
            store.setServerConfig(configResult.config.server)
            store.setSampleRate(configResult.config.audio.sampleRate)
            store.setChannels(configResult.config.audio.channels)
            store.setBufferSize(configResult.config.audio.bufferSize)
            store.setEncoderFormat(configResult.config.encoder.format)
            store.setEncoderBitrate(configResult.config.encoder.bitrate)
            store.setSelectedInputDevice(configResult.config.audio.device)
          }
          setLastConfigSavePath(null) // reset save path indicator
          break
        }

        case 'recording_stopped': {
          const recData = message.data as unknown as RecordingStoppedData
          setRecording(false)
          // Add to recordings list
          if (recData.path) {
            const filename = recData.path.split('/').pop() || recData.path.split('\\').pop() || recData.path
            addRecording({
              id: `rec-${Date.now()}`,
              filename,
              path: recData.path,
              startTime: new Date(Date.now() - recData.duration_secs * 1000),
              endTime: new Date(),
              fileSize: recData.file_size_bytes,
              format: 'WAV',
              duration: recData.duration_secs,
            })
          }
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
    [setVUMeters, setStreamStatus, setStreaming, setConnecting, setAudioDevices, updateChannel, setWaveformData, addRecording, setRecording, setTestConnectionResult, setTestingConnection, setLastConfigSavePath, attemptReconnect]
  )

  // Register message listener
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onEngineMessage(handleEngineMessage)

      // Request device list on mount
      window.electronAPI.engineCommand({ type: 'list_devices' })
    }

    return () => {
      // Clean up reconnect timer on unmount
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
    }
  }, [handleEngineMessage])

  // Start streaming
  const startStream = useCallback(async () => {
    if (!window.electronAPI) {
      console.warn('[Engine] Electron API not available')
      return
    }

    isManualStopRef.current = false
    reconnectAttemptsRef.current = 0
    wasStreamingRef.current = false
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

    isManualStopRef.current = true
    wasStreamingRef.current = false

    // Clear reconnect timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

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

  // Test connection
  const testConnection = useCallback(async (config: any) => {
    if (!window.electronAPI) return
    setTestingConnection(true)
    setTestConnectionResult(null)
    try {
      await window.electronAPI.engineCommand({ type: 'test_connection', config })
    } catch (err) {
      setTestingConnection(false)
      console.error('[Engine] Test connection failed:', err)
    }
  }, [setTestingConnection, setTestConnectionResult])

  // Save configuration
  const saveConfig = useCallback(async (path: string) => {
    if (!window.electronAPI) return
    try {
      await window.electronAPI.engineCommand({ type: 'save_config', path })
      setLastConfigSavePath(path)
    } catch (err) {
      console.error('[Engine] Save config failed:', err)
    }
  }, [setLastConfigSavePath])

  return {
    startStream,
    stopStream,
    sendCommand,
    testConnection,
    saveConfig,
  }
}
