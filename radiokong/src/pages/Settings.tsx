import { useState } from 'react'
import {
  Server,
  Mic,
  Headphones,
  Save,
  RotateCcw,
  Shield,
  CreditCard,
  Info,
  CheckCircle,
  Zap,
  Crown,
  ExternalLink,
  Loader2,
  Mail,
  MonitorSpeaker,
  Plus,
  Trash2,
  Network,
  Lock,
} from 'lucide-react'
import { useAppStore } from '../store'
import { PLANS, useSubscriptionStore, hasFeature, getTierLimit } from '../store/subscription'
import type { SubscriptionTier } from '../store/subscription'

type SettingsTab = 'server' | 'audio' | 'encoder' | 'subscription' | 'about'

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('server')

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'server', label: 'Server', icon: Server },
    { id: 'audio', label: 'Audio I/O', icon: MonitorSpeaker },
    { id: 'encoder', label: 'Encoder', icon: Headphones },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'about', label: 'About', icon: Info },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="text-sm text-surface-400">
          Configure your streaming server, audio devices, subscription, and preferences
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-1">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-brand-600/15 text-brand-400'
                    : 'text-surface-400 hover:bg-surface-800/60 hover:text-surface-200'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="col-span-3">
          {activeTab === 'server' && <ServerSettings />}
          {activeTab === 'audio' && <AudioSettings />}
          {activeTab === 'encoder' && <EncoderSettings />}
          {activeTab === 'subscription' && <AccountSettings />}
          {activeTab === 'about' && <AboutSettings />}
        </div>
      </div>
    </div>
  )
}

function ServerSettings() {
  const serverConfig = useAppStore((s) => s.serverConfig)
  const setServerConfig = useAppStore((s) => s.setServerConfig)
  const additionalServers = useAppStore((s) => s.additionalServers)
  const addAdditionalServer = useAppStore((s) => s.addAdditionalServer)
  const updateAdditionalServer = useAppStore((s) => s.updateAdditionalServer)
  const removeAdditionalServer = useAppStore((s) => s.removeAdditionalServer)
  const subscriptionTier = useSubscriptionStore((s) => s.tier)
  const canMultiServer = subscriptionTier !== 'free'
  const maxServers = getTierLimit(subscriptionTier, 'maxServers')

  return (
    <div className="space-y-6">
      {/* Primary Server */}
      <div className="glass-panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
          Primary Streaming Server
        </h3>
        <div className="space-y-4">
          {/* Protocol */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-surface-400">Protocol</label>
            <div className="flex gap-2">
              {(['icecast', 'shoutcast'] as const).map((proto) => (
                <button
                  key={proto}
                  onClick={() => setServerConfig({ protocol: proto })}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                    serverConfig.protocol === proto
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                  }`}
                >
                  {proto === 'icecast' ? 'Icecast 2' : 'SHOUTcast'}
                </button>
              ))}
            </div>
          </div>

          {/* Host + Port */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="mb-1.5 block text-[11px] font-medium text-surface-400">Server Host</label>
              <input
                type="text"
                value={serverConfig.host}
                onChange={(e) => setServerConfig({ host: e.target.value })}
                placeholder="e.g., streaming.example.com"
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white placeholder-surface-500 outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-surface-400">Port</label>
              <input
                type="number"
                value={serverConfig.port}
                onChange={(e) => setServerConfig({ port: parseInt(e.target.value) || 8000 })}
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Mount Point */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-surface-400">Mount Point</label>
            <input
              type="text"
              value={serverConfig.mount}
              onChange={(e) => setServerConfig({ mount: e.target.value })}
              placeholder="/live"
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white placeholder-surface-500 outline-none focus:border-brand-500"
            />
          </div>

          {/* Username + Password */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-surface-400">
                Username / Login
              </label>
              <input
                type="text"
                value={serverConfig.username}
                onChange={(e) => setServerConfig({ username: e.target.value })}
                placeholder={serverConfig.protocol === 'icecast' ? 'source' : 'admin'}
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white placeholder-surface-500 outline-none focus:border-brand-500"
              />
              <p className="mt-1 text-[10px] text-surface-500">
                {serverConfig.protocol === 'icecast'
                  ? 'Typically "source" for Icecast servers'
                  : 'Admin login for SHOUTcast'}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-surface-400">Password</label>
              <input
                type="password"
                value={serverConfig.password}
                onChange={(e) => setServerConfig({ password: e.target.value })}
                placeholder="Enter password"
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white placeholder-surface-500 outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500">
              <Save className="h-4 w-4" />
              Save Configuration
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-surface-800 px-4 py-2.5 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-700">
              <RotateCcw className="h-4 w-4" />
              Test Connection
            </button>
          </div>
        </div>
      </div>

      {/* Connection Info */}
      <div className="glass-panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">Connection Info</h3>
        <div className="rounded-lg bg-surface-800 p-4">
          <p className="mb-2 text-[11px] text-surface-400">Your stream will be available at:</p>
          <code className="text-sm font-mono text-emerald-400">
            http://{serverConfig.host}:{serverConfig.port}{serverConfig.mount}
          </code>
          <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-surface-500">Protocol</span>
              <span className="text-[10px] font-mono text-surface-300">
                {serverConfig.protocol === 'icecast' ? 'Icecast 2 (HTTP PUT)' : 'SHOUTcast (ICY)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-surface-500">Auth</span>
              <span className="text-[10px] font-mono text-surface-300">
                {serverConfig.username}:{'*'.repeat(serverConfig.password.length)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Server */}
      <div className="glass-panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-surface-400">
              Additional Servers (Multi-Output)
            </h3>
            {!canMultiServer && (
              <span className="rounded bg-surface-700 px-2 py-0.5 text-[9px] font-bold uppercase text-surface-400">
                PRO+
              </span>
            )}
          </div>
          {canMultiServer && (
            <button
              onClick={() => {
                addAdditionalServer({
                  id: `srv-${Date.now()}`,
                  host: '',
                  port: 8000,
                  mount: '/live',
                  username: 'source',
                  password: '',
                  protocol: 'icecast',
                  enabled: true,
                  label: `Server ${additionalServers.length + 2}`,
                })
              }}
              disabled={additionalServers.length >= (maxServers - 1)}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Server
            </button>
          )}
        </div>

        {!canMultiServer ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-surface-700 py-8 text-center">
            <Lock className="h-8 w-8 text-surface-600" />
            <p className="text-sm text-surface-400">Stream to multiple servers with Pro or Studio</p>
            <p className="text-[11px] text-surface-500">Simultaneously broadcast to Icecast, SHOUTcast, and more</p>
          </div>
        ) : additionalServers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-surface-700 p-6 text-center">
            <Network className="mx-auto h-8 w-8 text-surface-600" />
            <p className="mt-2 text-sm text-surface-400">No additional servers configured</p>
            <p className="text-[11px] text-surface-500">Add more servers to stream to multiple destinations at once</p>
          </div>
        ) : (
          <div className="space-y-3">
            {additionalServers.map((server) => (
              <div key={server.id} className="rounded-lg border border-surface-700/50 bg-surface-800/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={server.label}
                      onChange={(e) => updateAdditionalServer(server.id, { label: e.target.value })}
                      className="rounded border-none bg-transparent text-sm font-medium text-white outline-none"
                    />
                    <span className={`rounded px-2 py-0.5 text-[9px] font-bold ${server.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-700 text-surface-400'}`}>
                      {server.enabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateAdditionalServer(server.id, { enabled: !server.enabled })}
                      className="rounded px-2 py-1 text-[10px] text-surface-400 transition-colors hover:bg-surface-700"
                    >
                      {server.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => removeAdditionalServer(server.id)}
                      className="rounded p-1 text-surface-400 transition-colors hover:bg-red-600/20 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] text-surface-500">Host</label>
                    <input
                      type="text"
                      value={server.host}
                      onChange={(e) => updateAdditionalServer(server.id, { host: e.target.value })}
                      placeholder="streaming.example.com"
                      className="w-full rounded border border-surface-700 bg-surface-900 px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-surface-500">Port / Mount</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={server.port}
                        onChange={(e) => updateAdditionalServer(server.id, { port: parseInt(e.target.value) || 8000 })}
                        className="w-16 rounded border border-surface-700 bg-surface-900 px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500"
                      />
                      <input
                        type="text"
                        value={server.mount}
                        onChange={(e) => updateAdditionalServer(server.id, { mount: e.target.value })}
                        className="flex-1 rounded border border-surface-700 bg-surface-900 px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-surface-500">Username / Password</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={server.username}
                        onChange={(e) => updateAdditionalServer(server.id, { username: e.target.value })}
                        placeholder="source"
                        className="flex-1 rounded border border-surface-700 bg-surface-900 px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500"
                      />
                      <input
                        type="password"
                        value={server.password}
                        onChange={(e) => updateAdditionalServer(server.id, { password: e.target.value })}
                        className="flex-1 rounded border border-surface-700 bg-surface-900 px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AudioSettings() {
  const audioDevices = useAppStore((s) => s.audioDevices)
  const selectedInputDevice = useAppStore((s) => s.selectedInputDevice)
  const selectedOutputDevice = useAppStore((s) => s.selectedOutputDevice)
  const setSelectedInputDevice = useAppStore((s) => s.setSelectedInputDevice)
  const setSelectedOutputDevice = useAppStore((s) => s.setSelectedOutputDevice)
  const sampleRate = useAppStore((s) => s.sampleRate)
  const bufferSize = useAppStore((s) => s.bufferSize)
  const channels = useAppStore((s) => s.channels)
  const setSampleRate = useAppStore((s) => s.setSampleRate)
  const setBufferSize = useAppStore((s) => s.setBufferSize)
  const setChannels = useAppStore((s) => s.setChannels)

  // Mock devices for development
  const mockInputDevices = [
    { id: 'default', name: 'Default System Input', isInput: true, isDefault: true, channels: 2, sampleRates: [44100, 48000] },
    { id: 'mic-usb', name: 'USB Microphone (Blue Yeti)', isInput: true, isDefault: false, channels: 2, sampleRates: [44100, 48000, 96000] },
    { id: 'mixer-usb', name: 'USB Audio CODEC (Mixer)', isInput: true, isDefault: false, channels: 2, sampleRates: [44100, 48000] },
    { id: 'mic-built-in', name: 'Built-in Microphone', isInput: true, isDefault: false, channels: 1, sampleRates: [44100, 48000] },
  ]
  const mockOutputDevices = [
    { id: 'default-out', name: 'Default System Output', isInput: false, isDefault: true, channels: 2, sampleRates: [44100, 48000] },
    { id: 'headphones-usb', name: 'USB Headphones', isInput: false, isDefault: false, channels: 2, sampleRates: [44100, 48000] },
    { id: 'speakers-built-in', name: 'Built-in Speakers', isInput: false, isDefault: false, channels: 2, sampleRates: [44100, 48000] },
  ]

  const inputDevices = audioDevices.filter((d) => d.isInput).length > 0
    ? audioDevices.filter((d) => d.isInput)
    : mockInputDevices
  const outputDevices = audioDevices.filter((d) => !d.isInput).length > 0
    ? audioDevices.filter((d) => !d.isInput)
    : mockOutputDevices

  return (
    <div className="space-y-6">
      {/* Input Device Selection */}
      <div className="glass-panel p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-surface-400">
          <Mic className="h-4 w-4 text-emerald-400" />
          Input Device (Capture)
        </h3>
        <p className="mb-3 text-[11px] text-surface-500">
          Select the audio device used to capture your broadcast audio (microphone, mixer, line-in, etc.)
        </p>
        <div className="space-y-2">
          {inputDevices.map((device) => (
            <label
              key={device.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                selectedInputDevice === device.id || (selectedInputDevice === '' && device.isDefault)
                  ? 'border-emerald-500/50 bg-emerald-600/10'
                  : 'border-surface-700/50 bg-surface-800/50 hover:border-surface-600'
              }`}
            >
              <input
                type="radio"
                name="inputDevice"
                value={device.id}
                checked={selectedInputDevice === device.id || (selectedInputDevice === '' && device.isDefault)}
                onChange={() => setSelectedInputDevice(device.id)}
                className="accent-emerald-500"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{device.name}</p>
                <p className="text-[11px] text-surface-500">
                  {device.channels} channel{device.channels > 1 ? 's' : ''} &middot; {device.sampleRates.map((r) => `${r/1000}kHz`).join(', ')}
                </p>
              </div>
              {device.isDefault && (
                <span className="rounded bg-emerald-700/30 px-2 py-0.5 text-[10px] text-emerald-400">Default</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Output Device Selection */}
      <div className="glass-panel p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-surface-400">
          <Headphones className="h-4 w-4 text-blue-400" />
          Output Device (Monitor)
        </h3>
        <p className="mb-3 text-[11px] text-surface-500">
          Select where to play your stream monitor audio (headphones, speakers). This does not affect what your listeners hear.
        </p>
        <div className="space-y-2">
          {outputDevices.map((device) => (
            <label
              key={device.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                selectedOutputDevice === device.id || (selectedOutputDevice === '' && device.isDefault)
                  ? 'border-blue-500/50 bg-blue-600/10'
                  : 'border-surface-700/50 bg-surface-800/50 hover:border-surface-600'
              }`}
            >
              <input
                type="radio"
                name="outputDevice"
                value={device.id}
                checked={selectedOutputDevice === device.id || (selectedOutputDevice === '' && device.isDefault)}
                onChange={() => setSelectedOutputDevice(device.id)}
                className="accent-blue-500"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{device.name}</p>
                <p className="text-[11px] text-surface-500">
                  {device.channels} channel{device.channels > 1 ? 's' : ''} &middot; {device.sampleRates.map((r) => `${r/1000}kHz`).join(', ')}
                </p>
              </div>
              {device.isDefault && (
                <span className="rounded bg-blue-700/30 px-2 py-0.5 text-[10px] text-blue-400">Default</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Audio Configuration */}
      <div className="glass-panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">Audio Configuration</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-surface-400">Sample Rate</label>
            <select
              value={sampleRate}
              onChange={(e) => setSampleRate(parseInt(e.target.value))}
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
            >
              <option value={44100}>44100 Hz (CD Quality)</option>
              <option value={48000}>48000 Hz (Studio)</option>
              <option value={96000}>96000 Hz (High-Res)</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-surface-400">Buffer Size</label>
            <select
              value={bufferSize}
              onChange={(e) => setBufferSize(parseInt(e.target.value))}
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
            >
              <option value={512}>512 samples (Low latency)</option>
              <option value={1024}>1024 samples</option>
              <option value={2048}>2048 samples (Recommended)</option>
              <option value={4096}>4096 samples (Stable)</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-surface-400">Channels</label>
            <select
              value={channels}
              onChange={(e) => setChannels(parseInt(e.target.value))}
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
            >
              <option value={1}>Mono</option>
              <option value={2}>Stereo</option>
            </select>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-surface-500">
          Lower buffer size reduces latency but may cause audio glitches. 2048 is recommended for streaming.
        </p>
      </div>
    </div>
  )
}

function EncoderSettings() {
  const encoderFormat = useAppStore((s) => s.encoderFormat)
  const encoderBitrate = useAppStore((s) => s.encoderBitrate)
  const setEncoderFormat = useAppStore((s) => s.setEncoderFormat)
  const setEncoderBitrate = useAppStore((s) => s.setEncoderBitrate)
  const tier = useSubscriptionStore((s) => s.tier)

  const formats = [
    { id: 'mp3' as const, name: 'MP3', desc: 'Universal compatibility', ext: 'LAME', tier: 'free' },
    { id: 'ogg' as const, name: 'OGG Vorbis', desc: 'Open source, great quality', ext: 'oxideav-vorbis', tier: 'pro' },
    { id: 'aac' as const, name: 'AAC', desc: 'Efficient, modern', ext: 'ADTS container', tier: 'pro' },
    { id: 'flac' as const, name: 'FLAC', desc: 'Lossless quality', ext: 'FLAC stream', tier: 'studio' },
  ]

  const bitrates = [64, 96, 128, 160, 192, 224, 256, 320]

  const isFormatLocked = (fmt: typeof formats[0]) => {
    if (fmt.tier === 'free') return false
    if (fmt.tier === 'pro' && tier === 'free') return true
    if (fmt.tier === 'studio' && tier !== 'studio') return true
    return false
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">Encoder Format</h3>
        <div className="grid grid-cols-2 gap-3">
          {formats.map((fmt) => {
            const locked = isFormatLocked(fmt)
            return (
              <button
                key={fmt.id}
                onClick={() => !locked && setEncoderFormat(fmt.id)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  locked
                    ? 'border-surface-700/30 bg-surface-800/20 opacity-50 cursor-not-allowed'
                    : encoderFormat === fmt.id
                    ? 'border-brand-500/50 bg-brand-600/10'
                    : 'border-surface-700/50 bg-surface-800/50 hover:border-surface-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{fmt.name}</p>
                  {locked && (
                    <span className="flex items-center gap-1 rounded bg-surface-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-surface-400">
                      <Lock className="h-2.5 w-2.5" />
                      {fmt.tier}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-surface-400">{fmt.desc}</p>
                <p className="mt-1 text-[10px] font-mono text-surface-500">{fmt.ext}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="glass-panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">Bitrate</h3>
        <div className="flex flex-wrap gap-2">
          {bitrates.map((br) => (
            <button
              key={br}
              onClick={() => setEncoderBitrate(br)}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                encoderBitrate === br
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
              }`}
            >
              {br} kbps
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-surface-500">
          Recommended: 192 kbps for MP3, 128 kbps for AAC, 160 kbps for OGG
        </p>
      </div>
    </div>
  )
}

function AccountSettings() {
  const subscription = useSubscriptionStore()
  const [email, setEmail] = useState(subscription.email)

  const handleUpgrade = async (tier: SubscriptionTier) => {
    await subscription.setEmail(email)
    await subscription.initiatePayment(tier)
  }

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="glass-panel p-6">
        <div className="mb-4 flex items-center gap-3">
          <Shield className="h-5 w-5 text-brand-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-surface-400">
            Subscription Plan
          </h3>
          {subscription.tier !== 'free' && (
            <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
              subscription.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {subscription.status}
            </span>
          )}
        </div>

        {/* Email input */}
        <div className="mb-6">
          <label className="mb-1.5 flex items-center gap-2 text-[11px] font-medium text-surface-400">
            <Mail className="h-3.5 w-3.5" /> Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white placeholder-surface-500 outline-none focus:border-brand-500"
          />
          <p className="mt-1 text-[10px] text-surface-500">
            Used for PesaPal payment notifications and subscription management
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.tier}
              plan={plan}
              isCurrent={subscription.tier === plan.tier}
              isLoading={subscription.isLoading}
              onUpgrade={() => handleUpgrade(plan.tier)}
            />
          ))}
        </div>

        {/* PesaPal branding */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-surface-500">
          <span>Powered by</span>
          <span className="font-bold text-surface-400">PesaPal</span>
          <span>&middot; Secure payments across Africa</span>
        </div>
      </div>

      {/* Error display */}
      {subscription.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">{subscription.error}</p>
        </div>
      )}

      {/* Manage subscription */}
      {subscription.tier !== 'free' && (
        <div className="glass-panel p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
            Manage Subscription
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Current Plan</p>
                <p className="text-[11px] text-surface-400">
                  RadioKong {PLANS.find((p) => p.tier === subscription.tier)?.name}
                  {subscription.currentPeriodEnd && (
                    <> &middot; Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</>
                  )}
                </p>
              </div>
              <button
                onClick={() => subscription.cancelSubscription()}
                className="rounded-lg border border-surface-700 px-4 py-2 text-sm text-surface-400 transition-colors hover:border-red-500/50 hover:text-red-400"
              >
                Cancel Subscription
              </button>
            </div>

            {/* Feature summary */}
            <div className="rounded-lg bg-surface-800 p-4">
              <p className="mb-2 text-[11px] font-medium text-surface-400">Your plan includes:</p>
              <div className="grid grid-cols-2 gap-2">
                {PLANS.find((p) => p.tier === subscription.tier)?.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-[11px] text-surface-300">
                    <CheckCircle className="h-3 w-3 flex-shrink-0 text-brand-500" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PlanCard({
  plan,
  isCurrent,
  isLoading,
  onUpgrade,
}: {
  plan: typeof PLANS[0]
  isCurrent: boolean
  isLoading: boolean
  onUpgrade: () => void
}) {
  const iconMap: Record<string, any> = {
    free: Zap,
    pro: Shield,
    studio: Crown,
  }
  const Icon = iconMap[plan.tier] || Zap

  return (
    <div
      className={`rounded-xl border p-5 ${
        plan.highlighted
          ? 'border-brand-500/50 bg-brand-600/5'
          : 'border-surface-700/50 bg-surface-800/50'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${plan.highlighted ? 'text-brand-400' : 'text-surface-400'}`} />
        <h4 className="text-sm font-bold text-white">{plan.name}</h4>
      </div>
      <div className="mt-2">
        <span className="text-2xl font-bold text-white">
          {plan.price === 0 ? '$0' : `$${plan.price}`}
        </span>
        <span className="text-[11px] text-surface-400">{plan.period}</span>
      </div>
      <ul className="mt-4 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-[11px] text-surface-300">
            <CheckCircle className="h-3 w-3 flex-shrink-0 text-brand-500" />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onUpgrade}
        disabled={isCurrent || isLoading}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
          isCurrent
            ? 'bg-surface-700 text-surface-400'
            : plan.highlighted
            ? 'bg-brand-600 text-white hover:bg-brand-500'
            : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
        }`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isCurrent ? (
          'Current Plan'
        ) : plan.price === 0 ? (
          'Free Forever'
        ) : (
          <>
            Upgrade via PesaPal
            <ExternalLink className="h-3.5 w-3.5" />
          </>
        )}
      </button>
    </div>
  )
}

function AboutSettings() {
  return (
    <div className="glass-panel p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600">
          <Mic className="h-8 w-8 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">RadioKong</h3>
          <p className="text-sm text-surface-400">Professional Internet Radio Streaming Software</p>
          <p className="text-[11px] text-surface-500">Version 0.2.0 (Alpha)</p>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-surface-500">Audio Engine</span>
          <span className="text-[11px] font-mono text-surface-300">Rust + CPAL + LAME</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-surface-500">UI Framework</span>
          <span className="text-[11px] font-mono text-surface-300">React + Electron</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-surface-500">Encoders</span>
          <span className="text-[11px] font-mono text-surface-300">LAME MP3 / OGG Vorbis / AAC / FLAC</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-surface-500">Protocols</span>
          <span className="text-[11px] font-mono text-surface-300">Icecast 2 / SHOUTcast</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-surface-500">Payments</span>
          <span className="text-[11px] font-mono text-surface-300">PesaPal</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-surface-500">Auto-Reconnect</span>
          <span className="text-[11px] font-mono text-surface-300">5 retries / 5s interval</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-surface-500">Multi-Server</span>
          <span className="text-[11px] font-mono text-surface-300">Pro/Studio tiers</span>
        </div>
      </div>
    </div>
  )
}
