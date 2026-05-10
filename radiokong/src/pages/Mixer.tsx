import { useState } from 'react'
import { Plus, Volume2, VolumeX, X } from 'lucide-react'
import { useAppStore, CHANNEL_COLORS } from '../store'
import { useSubscriptionStore, hasFeature, getTierLimit } from '../store/subscription'
import { MixerChannel } from '../components/mixer/MixerChannel'
import { StereoVUMeter } from '../components/audio/VUMeter'
import { VerticalFader, RotaryKnob } from '../components/mixer/RotaryKnob'

export function Mixer() {
  const mixerChannels = useAppStore((s) => s.mixerChannels)
  const masterVolume = useAppStore((s) => s.masterVolume)
  const masterMuted = useAppStore((s) => s.masterMuted)
  const updateChannel = useAppStore((s) => s.updateChannel)
  const addChannel = useAppStore((s) => s.addChannel)
  const removeChannel = useAppStore((s) => s.removeChannel)
  const setMasterVolume = useAppStore((s) => s.setMasterVolume)
  const setMasterMuted = useAppStore((s) => s.setMasterMuted)
  const tier = useSubscriptionStore((s) => s.tier)

  const [activeTab, setActiveTab] = useState<'channels' | 'dsp'>('channels')

  const masterVU = {
    left: Math.max(...mixerChannels.map((ch) => ch.vuLevel.left)) * masterVolume,
    right: Math.max(...mixerChannels.map((ch) => ch.vuLevel.right)) * masterVolume,
  }

  const canDSP = hasFeature(tier, 'dsp')
  const maxChannels = getTierLimit(tier, 'maxChannels')

  const handleAddChannel = async () => {
    const channelNum = mixerChannels.length + 1
    const id = `ch-${Date.now()}`
    const color = CHANNEL_COLORS[(mixerChannels.length) % CHANNEL_COLORS.length]
    const newChannel = {
      id,
      name: `Channel ${channelNum}`,
      volume: 0.7,
      muted: false,
      solo: false,
      pan: 0,
      color,
      vuLevel: { left: 0, right: 0 },
    }
    addChannel(newChannel)
    // Tell the engine about the new channel (only effective while streaming;
    // the channel config is also sent when the engine starts via getEngineConfig)
    if (window.electronAPI) {
      await window.electronAPI.engineCommand({
        type: 'add_channel',
        id,
        name: newChannel.name,
        volume: newChannel.volume,
        pan: newChannel.pan,
      })
    }
  }

  const handleRemoveChannel = async (id: string) => {
    removeChannel(id)
    if (window.electronAPI) {
      await window.electronAPI.engineCommand({ type: 'remove_channel', id })
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Mixer</h2>
          <p className="text-sm text-surface-400">
            Control audio levels, DSP effects, and channel routing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-surface-500">
            {mixerChannels.length} of {maxChannels === Infinity ? '∞' : maxChannels} channels
          </span>
          <button
            onClick={handleAddChannel}
            disabled={mixerChannels.length >= (maxChannels === Infinity ? 999 : maxChannels)}
            className="flex items-center gap-2 rounded-lg bg-surface-800 px-3 py-2 text-sm text-surface-300 transition-colors hover:bg-surface-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add Channel
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 rounded-lg bg-surface-900 p-1">
        <button
          onClick={() => setActiveTab('channels')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'channels'
              ? 'bg-surface-700 text-white'
              : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          Channels
        </button>
        <button
          onClick={() => setActiveTab('dsp')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'dsp'
              ? 'bg-surface-700 text-white'
              : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          DSP Effects
        </button>
      </div>

      {activeTab === 'channels' ? (
        <div className="space-y-6">
          {/* Channel Strip Area */}
          <div className="glass-panel p-6">
            <div className="flex items-end gap-4 overflow-x-auto pb-2">
              {/* Individual Channels */}
              {mixerChannels.map((channel) => (
                <div key={channel.id} className="relative group">
                  <MixerChannel
                    channel={channel}
                    onUpdate={updateChannel}
                  />
                  {/* Remove channel button (only if more than 1 channel) */}
                  {mixerChannels.length > 1 && (
                    <button
                      onClick={() => handleRemoveChannel(channel.id)}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-800 text-surface-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600 hover:text-white"
                      title="Remove channel"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}

              {/* Separator */}
              <div className="mx-2 h-48 w-px bg-surface-700" />

              {/* Master Channel */}
              <div className="flex flex-col items-center gap-3 rounded-xl border border-brand-600/30 bg-brand-600/5 p-4">
                <div className="text-center">
                  <div className="mx-auto mb-1 h-1 w-8 rounded-full bg-brand-500" />
                  <span className="text-[11px] font-bold text-brand-400">
                    MASTER
                  </span>
                </div>

                <StereoVUMeter
                  leftLevel={masterVU.left}
                  rightLevel={masterVU.right}
                  height={120}
                />

                <VerticalFader
                  value={masterVolume}
                  min={0}
                  max={1}
                  step={0.01}
                  height={120}
                  color="#3b82f6"
                  onChange={(v) => {
                    setMasterVolume(v)
                    // Send master volume to engine
                    // The engine's mixer uses channel 0 volume as master,
                    // so we send a set_volume for a virtual "master" channel
                    if (window.electronAPI) {
                      window.electronAPI.engineCommand({
                        type: 'set_volume',
                        channel: 'master',
                        volume: v,
                      }).catch(() => {})
                    }
                  }}
                />

                <button
                  onClick={() => {
                    const newMuted = !masterMuted
                    setMasterMuted(newMuted)
                    // Send master mute to engine
                    if (window.electronAPI) {
                      window.electronAPI.engineCommand({
                        type: 'set_mute',
                        channel: 'master',
                        muted: newMuted,
                      }).catch(() => {})
                    }
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded text-xs font-bold transition-colors ${
                    masterMuted
                      ? 'bg-red-600 text-white'
                      : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                  }`}
                >
                  {masterMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : canDSP ? (
        <DSPPanel />
      ) : (
        <div className="glass-panel flex flex-col items-center gap-4 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-800">
            <Volume2 className="h-8 w-8 text-surface-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">DSP Effects</h3>
            <p className="text-sm text-surface-400">
              Unlock EQ, Compressor, Limiter, and Noise Gate with Pro or Studio
            </p>
          </div>
          <a
            href="#/settings"
            className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
          >
            Upgrade via PesaPal
          </a>
        </div>
      )}
    </div>
  )
}

function DSPPanel() {
  const [eqEnabled, setEqEnabled] = useState(false)
  const [eqBands, setEqBands] = useState([
    { freq: 60, gain: 0, label: '60Hz' },
    { freq: 250, gain: 0, label: '250Hz' },
    { freq: 1000, gain: 0, label: '1kHz' },
    { freq: 4000, gain: 0, label: '4kHz' },
    { freq: 12000, gain: 0, label: '12kHz' },
  ])

  const [compressor, setCompressor] = useState({
    enabled: false,
    threshold: -20,
    ratio: 4,
    attack: 10,
    release: 100,
    gain: 0,
  })

  const [limiter, setLimiter] = useState({
    enabled: true,
    ceiling: -1,
    release: 50,
  })

  const [gate, setGate] = useState({
    enabled: false,
    threshold: -40,
    attack: 1,
    release: 100,
  })

  // Send DSP commands to engine
  const sendDSPCommand = async (command: any) => {
    if (window.electronAPI) {
      await window.electronAPI.engineCommand(command)
    }
  }

  const handleEQToggle = () => {
    const newEnabled = !eqEnabled
    setEqEnabled(newEnabled)
    sendDSPCommand({ type: 'set_eq_enabled', enabled: newEnabled })
  }

  const handleEQBandChange = (index: number, gain: number) => {
    const newBands = [...eqBands]
    newBands[index].gain = gain
    setEqBands(newBands)
    sendDSPCommand({ type: 'set_eq_band', band_index: index, gain_db: gain })
  }

  const handleCompressorToggle = () => {
    const newEnabled = !compressor.enabled
    setCompressor((c) => ({ ...c, enabled: newEnabled }))
    sendDSPCommand({ type: 'set_compressor', enabled: newEnabled })
  }

  const handleCompressorChange = (field: string, value: number) => {
    setCompressor((c) => ({ ...c, [field]: value }))
    const cmd: any = { type: 'set_compressor' }
    switch (field) {
      case 'threshold': cmd.threshold_db = value; break
      case 'ratio': cmd.ratio = value; break
      case 'attack': cmd.attack_ms = value; break
      case 'release': cmd.release_ms = value; break
      case 'gain': cmd.makeup_gain_db = value; break
    }
    sendDSPCommand(cmd)
  }

  const handleLimiterToggle = () => {
    const newEnabled = !limiter.enabled
    setLimiter((l) => ({ ...l, enabled: newEnabled }))
    sendDSPCommand({ type: 'set_limiter', enabled: newEnabled })
  }

  const handleLimiterChange = (field: string, value: number) => {
    setLimiter((l) => ({ ...l, [field]: value }))
    const cmd: any = { type: 'set_limiter' }
    switch (field) {
      case 'ceiling': cmd.ceiling_db = value; break
      case 'release': cmd.release_ms = value; break
    }
    sendDSPCommand(cmd)
  }

  const handleGateToggle = () => {
    const newEnabled = !gate.enabled
    setGate((g) => ({ ...g, enabled: newEnabled }))
    sendDSPCommand({ type: 'set_gate', enabled: newEnabled })
  }

  const handleGateChange = (field: string, value: number) => {
    setGate((g) => ({ ...g, [field]: value }))
    const cmd: any = { type: 'set_gate' }
    switch (field) {
      case 'threshold': cmd.threshold_db = value; break
      case 'attack': cmd.attack_ms = value; break
      case 'release': cmd.release_ms = value; break
    }
    sendDSPCommand(cmd)
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* EQ */}
      <div className="glass-panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-surface-400">
            Equalizer
          </h3>
          <button
            onClick={handleEQToggle}
            className={`rounded px-2 py-1 text-[10px] font-bold ${
              eqEnabled
                ? 'bg-emerald-600 text-white'
                : 'bg-surface-700 text-surface-400'
            }`}
          >
            {eqEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="flex items-end justify-between gap-4 px-4">
          {eqBands.map((band, i) => (
            <div key={band.freq} className="flex flex-col items-center gap-2">
              <RotaryKnob
                value={band.gain}
                min={-12}
                max={12}
                step={0.5}
                size={44}
                unit="dB"
                color={band.gain > 0 ? '#10b981' : band.gain < 0 ? '#ef4444' : '#3b82f6'}
                onChange={(v) => handleEQBandChange(i, v)}
              />
              <span className="text-[10px] text-surface-400">{band.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Compressor */}
      <div className="glass-panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-surface-400">
            Compressor
          </h3>
          <button
            onClick={handleCompressorToggle}
            className={`rounded px-2 py-1 text-[10px] font-bold ${
              compressor.enabled
                ? 'bg-blue-600 text-white'
                : 'bg-surface-700 text-surface-400'
            }`}
          >
            {compressor.enabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <RotaryKnob
            label="Threshold"
            value={compressor.threshold}
            unit="dB"
            min={-60}
            max={0}
            step={1}
            size={52}
            color="#3b82f6"
            onChange={(v) => handleCompressorChange('threshold', v)}
          />
          <RotaryKnob
            label="Ratio"
            value={compressor.ratio}
            unit=":1"
            min={1}
            max={20}
            step={0.5}
            size={52}
            color="#3b82f6"
            onChange={(v) => handleCompressorChange('ratio', v)}
          />
          <RotaryKnob
            label="Gain"
            value={compressor.gain}
            unit="dB"
            min={0}
            max={24}
            step={0.5}
            size={52}
            color="#10b981"
            onChange={(v) => handleCompressorChange('gain', v)}
          />
          <RotaryKnob
            label="Attack"
            value={compressor.attack}
            unit="ms"
            min={0.1}
            max={100}
            step={0.1}
            size={52}
            color="#f59e0b"
            onChange={(v) => handleCompressorChange('attack', v)}
          />
          <RotaryKnob
            label="Release"
            value={compressor.release}
            unit="ms"
            min={10}
            max={1000}
            step={10}
            size={52}
            color="#f59e0b"
            onChange={(v) => handleCompressorChange('release', v)}
          />
        </div>
      </div>

      {/* Limiter */}
      <div className="glass-panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-surface-400">
            Limiter
          </h3>
          <button
            onClick={handleLimiterToggle}
            className={`rounded px-2 py-1 text-[10px] font-bold ${
              limiter.enabled
                ? 'bg-red-600 text-white'
                : 'bg-surface-700 text-surface-400'
            }`}
          >
            {limiter.enabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="flex items-center justify-center gap-8">
          <RotaryKnob
            label="Ceiling"
            value={limiter.ceiling}
            unit="dB"
            min={-12}
            max={0}
            step={0.5}
            size={60}
            color="#ef4444"
            onChange={(v) => handleLimiterChange('ceiling', v)}
          />
          <RotaryKnob
            label="Release"
            value={limiter.release}
            unit="ms"
            min={1}
            max={500}
            step={1}
            size={60}
            color="#f59e0b"
            onChange={(v) => handleLimiterChange('release', v)}
          />
        </div>
      </div>

      {/* Gate */}
      <div className="glass-panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-surface-400">
            Noise Gate
          </h3>
          <button
            onClick={handleGateToggle}
            className={`rounded px-2 py-1 text-[10px] font-bold ${
              gate.enabled
                ? 'bg-purple-600 text-white'
                : 'bg-surface-700 text-surface-400'
            }`}
          >
            {gate.enabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="flex items-center justify-center gap-8">
          <RotaryKnob
            label="Threshold"
            value={gate.threshold}
            unit="dB"
            min={-80}
            max={0}
            step={1}
            size={60}
            color="#8b5cf6"
            onChange={(v) => handleGateChange('threshold', v)}
          />
          <RotaryKnob
            label="Attack"
            value={gate.attack}
            unit="ms"
            min={0.1}
            max={50}
            step={0.1}
            size={60}
            color="#f59e0b"
            onChange={(v) => handleGateChange('attack', v)}
          />
          <RotaryKnob
            label="Release"
            value={gate.release}
            unit="ms"
            min={10}
            max={1000}
            step={10}
            size={60}
            color="#f59e0b"
            onChange={(v) => handleGateChange('release', v)}
          />
        </div>
      </div>
    </div>
  )
}
