import { useState } from 'react'
import { Volume2, VolumeX, Headphones } from 'lucide-react'
import { StereoVUMeter } from '../audio/VUMeter'
import type { MixerChannelState } from '../../store'

interface MixerChannelProps {
  channel: MixerChannelState
  onUpdate: (id: string, updates: Partial<MixerChannelState>) => void
}

export function MixerChannel({ channel, onUpdate }: MixerChannelProps) {
  const [isHovered, setIsHovered] = useState(false)

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(channel.id, { volume: parseFloat(e.target.value) })
  }

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(channel.id, { pan: parseFloat(e.target.value) })
  }

  const handleMuteToggle = () => {
    onUpdate(channel.id, { muted: !channel.muted })
  }

  const handleSoloToggle = () => {
    onUpdate(channel.id, { solo: !channel.solo })
  }

  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-xl p-4 transition-all duration-200 ${
        channel.muted
          ? 'bg-surface-900/50 opacity-60'
          : 'bg-surface-900/80 border border-surface-700/50'
      } ${isHovered ? 'border-surface-600' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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

      {/* Volume Fader */}
      <div className="flex flex-col items-center gap-2">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={channel.volume}
          onChange={handleVolumeChange}
          className="fader-vertical"
          style={{
            writingMode: 'vertical-lr' as any,
            direction: 'rtl',
            width: '32px',
            height: '120px',
          }}
        />
        <span className="text-[10px] font-mono text-surface-400">
          {Math.round(channel.volume * 100)}%
        </span>
      </div>

      {/* Pan knob */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] text-surface-500">PAN</span>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={channel.pan}
          onChange={handlePanChange}
          className="h-2 w-16 accent-brand-500"
        />
        <span className="text-[9px] font-mono text-surface-500">
          {channel.pan === 0 ? 'C' : channel.pan < 0 ? `L${Math.abs(Math.round(channel.pan * 100))}` : `R${Math.round(channel.pan * 100)}`}
        </span>
      </div>

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
    </div>
  )
}
