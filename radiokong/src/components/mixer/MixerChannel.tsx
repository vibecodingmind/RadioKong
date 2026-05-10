import { useState } from 'react'
import { Volume2, VolumeX, Headphones, ChevronDown } from 'lucide-react'
import { StereoVUMeter } from '../audio/VUMeter'
import { VerticalFader, RotaryKnob } from './RotaryKnob'
import { useAppStore } from '../../store'
import type { MixerChannelState } from '../../store'

interface MixerChannelProps {
  channel: MixerChannelState
  onUpdate: (id: string, updates: Partial<MixerChannelState>) => void
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
        onChange={(v) => onUpdate(channel.id, { volume: v })}
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
        onChange={(v) => onUpdate(channel.id, { pan: v })}
      />

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={() => onUpdate(channel.id, { muted: !channel.muted })}
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
          onClick={() => onUpdate(channel.id, { solo: !channel.solo })}
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
              onClick={() => { onUpdate(channel.id, { device: undefined }); setShowDeviceSelect(false) }}
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[10px] transition-colors hover:bg-surface-700 ${
                !channel.device ? 'text-brand-400' : 'text-surface-300'
              }`}
            >
              Default
            </button>
            {devices.map((device) => (
              <button
                key={device.id}
                onClick={() => { onUpdate(channel.id, { device: device.id }); setShowDeviceSelect(false) }}
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
