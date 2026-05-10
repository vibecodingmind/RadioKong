import { useState } from 'react'
import { VolumeX, Headphones, ChevronDown } from 'lucide-react'
import { StereoVUMeter } from '../audio/VUMeter'
import { VerticalFader, RotaryKnob } from './RotaryKnob'
import { useAppStore } from '../../store'
import type { MixerChannelState } from '../../store'
import type { EngineCommand } from '../../types'

interface MixerChannelProps {
  channel: MixerChannelState
  onUpdate: (id: string, updates: Partial<MixerChannelState>) => void
}

/**
 * Send a command to the Rust engine via IPC.
 * Commands are silently dropped if the engine is not running (which is fine —
 * the store always updates immediately for responsive UI, and the engine will
 * sync when it starts up via the config sent with the `start` command).
 */
function sendEngineCommand(command: EngineCommand) {
  if (window.electronAPI) {
    window.electronAPI.engineCommand(command).catch((err: Error) => {
      console.warn('[MixerChannel] Engine command failed:', err.message)
    })
  }
}

export function MixerChannel({ channel, onUpdate }: MixerChannelProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showDeviceSelect, setShowDeviceSelect] = useState(false)

  const audioDevices = useAppStore((s) => s.audioDevices)
  const inputDevices = audioDevices.filter((d) => d.isInput)

  // Mock devices for when engine hasn't reported real devices
  const mockInputDevices = [
    { id: 'default-input', name: 'Default Input', isInput: true, isDefault: true, channels: 2, sampleRates: [44100] },
    { id: 'mic-usb', name: 'USB Microphone', isInput: true, isDefault: false, channels: 2, sampleRates: [44100, 48000] },
    { id: 'mixer-usb', name: 'USB Audio CODEC', isInput: true, isDefault: false, channels: 2, sampleRates: [44100, 48000] },
  ]
  const devices = inputDevices.length > 0 ? inputDevices : mockInputDevices

  const currentDeviceName = channel.device
    ? devices.find((d) => d.id === channel.device)?.name || channel.device
    : 'Default'

  // Handlers that update BOTH the store (for immediate UI response) AND the engine

  const handleVolumeChange = (v: number) => {
    onUpdate(channel.id, { volume: v })
    sendEngineCommand({ type: 'set_volume', channel: channel.id, volume: v })
  }

  const handlePanChange = (v: number) => {
    onUpdate(channel.id, { pan: v })
    sendEngineCommand({ type: 'set_pan', channel: channel.id, pan: v })
  }

  const handleMuteToggle = () => {
    const newMuted = !channel.muted
    onUpdate(channel.id, { muted: newMuted })
    sendEngineCommand({ type: 'set_mute', channel: channel.id, muted: newMuted })
  }

  const handleSoloToggle = () => {
    const newSolo = !channel.solo
    onUpdate(channel.id, { solo: newSolo })
    sendEngineCommand({ type: 'set_solo', channel: channel.id, solo: newSolo })
  }

  const handleDeviceChange = (deviceId: string | undefined) => {
    onUpdate(channel.id, { device: deviceId })
    if (deviceId) {
      sendEngineCommand({ type: 'set_channel_device', channel: channel.id, device: deviceId })
    }
    setShowDeviceSelect(false)
  }

  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-xl p-4 transition-all duration-200 ${
        channel.muted
          ? 'bg-surface-900/50 opacity-60'
          : 'bg-surface-900/80 border border-surface-700/50'
      } ${isHovered ? 'border-surface-600' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setShowDeviceSelect(false) }}
    >
      {/* Channel name */}
      <div className="text-center">
        <div
          className="mx-auto mb-1 h-1 w-8 rounded-full"
          style={{ backgroundColor: channel.color }}
        />
        <span className="text-[11px] font-medium text-surface-300">
          {channel.name}
        </span>
      </div>

      {/* VU Meter */}
      <StereoVUMeter
        leftLevel={channel.vuLevel.left}
        rightLevel={channel.vuLevel.right}
        height={120}
      />

      {/* Volume Fader (polished) */}
      <VerticalFader
        value={channel.volume}
        min={0}
        max={1}
        step={0.01}
        height={120}
        color={channel.color}
        onChange={handleVolumeChange}
      />

      {/* Pan knob (polished) */}
      <RotaryKnob
        value={channel.pan}
        min={-1}
        max={1}
        step={0.01}
        size={36}
        label="PAN"
        color={channel.color}
        onChange={handlePanChange}
      />

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={handleMuteToggle}
          className={`flex h-7 w-7 items-center justify-center rounded text-[10px] font-bold transition-colors ${
            channel.muted
              ? 'bg-red-600 text-white'
              : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
          }`}
          title="Mute"
        >
          {channel.muted ? <VolumeX className="h-3.5 w-3.5" /> : 'M'}
        </button>
        <button
          onClick={handleSoloToggle}
          className={`flex h-7 w-7 items-center justify-center rounded text-[10px] font-bold transition-colors ${
            channel.solo
              ? 'bg-yellow-600 text-white'
              : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
          }`}
          title="Solo"
        >
          S
        </button>
        <button
          className="flex h-7 w-7 items-center justify-center rounded bg-surface-700 text-surface-300 transition-colors hover:bg-surface-600"
          title="Monitor"
        >
          <Headphones className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Device Assignment */}
      <div className="relative w-full">
        <button
          onClick={() => setShowDeviceSelect(!showDeviceSelect)}
          className="flex w-full items-center justify-between gap-1 rounded bg-surface-800 px-2 py-1.5 text-[9px] text-surface-400 transition-colors hover:bg-surface-700"
          title="Assign audio device"
        >
          <span className="truncate">{currentDeviceName}</span>
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        </button>
        {showDeviceSelect && (
          <div className="absolute bottom-full left-0 z-10 mb-1 w-full rounded-lg border border-surface-700 bg-surface-800 py-1 shadow-xl">
            <button
              onClick={() => handleDeviceChange(undefined)}
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[10px] transition-colors hover:bg-surface-700 ${
                !channel.device ? 'text-brand-400' : 'text-surface-300'
              }`}
            >
              Default
            </button>
            {devices.map((device) => (
              <button
                key={device.id}
                onClick={() => handleDeviceChange(device.id)}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[10px] transition-colors hover:bg-surface-700 ${
                  channel.device === device.id ? 'text-brand-400' : 'text-surface-300'
                }`}
              >
                {device.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
