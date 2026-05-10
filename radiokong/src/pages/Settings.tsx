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
} from 'lucide-react'
import { useAppStore } from '../store'

type SettingsTab = 'server' | 'audio' | 'encoder' | 'account' | 'about'

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('server')

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'server', label: 'Server', icon: Server },
    { id: 'audio', label: 'Audio', icon: Mic },
    { id: 'encoder', label: 'Encoder', icon: Headphones },
    { id: 'account', label: 'Account', icon: CreditCard },
    { id: 'about', label: 'About', icon: Info },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="text-sm text-surface-400">
          Configure your streaming server, audio devices, and preferences
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Settings Navigation */}
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

        {/* Settings Content */}
        <div className="col-span-3">
          {activeTab === 'server' && <ServerSettings />}
          {activeTab === 'audio' && <AudioSettings />}
          {activeTab === 'encoder' && <EncoderSettings />}
          {activeTab === 'account' && <AccountSettings />}
          {activeTab === 'about' && <AboutSettings />}
        </div>
      </div>
    </div>
  )
}

function ServerSettings() {
  const serverConfig = useAppStore((s) => s.serverConfig)
  const setServerConfig = useAppStore((s) => s.setServerConfig)

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
          Streaming Server
        </h3>
        <div className="space-y-4">
          {/* Protocol */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-surface-400">
              Protocol
            </label>
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
                  {proto.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Host & Port */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="mb-1.5 block text-[11px] font-medium text-surface-400">
                Server Host
              </label>
              <input
                type="text"
                value={serverConfig.host}
                onChange={(e) => setServerConfig({ host: e.target.value })}
                placeholder="e.g., streaming.example.com"
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white placeholder-surface-500 outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-surface-400">
                Port
              </label>
              <input
                type="number"
                value={serverConfig.port}
                onChange={(e) =>
                  setServerConfig({ port: parseInt(e.target.value) || 8000 })
                }
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Mount Point */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-surface-400">
              Mount Point
            </label>
            <input
              type="text"
              value={serverConfig.mount}
              onChange={(e) => setServerConfig({ mount: e.target.value })}
              placeholder="/live"
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white placeholder-surface-500 outline-none focus:border-brand-500"
            />
          </div>

          {/* Credentials */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-surface-400">
                Username
              </label>
              <input
                type="text"
                value={serverConfig.username}
                onChange={(e) => setServerConfig({ username: e.target.value })}
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-surface-400">
                Password
              </label>
              <input
                type="password"
                value={serverConfig.password}
                onChange={(e) => setServerConfig({ password: e.target.value })}
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Test Connection */}
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
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
          Connection Info
        </h3>
        <div className="rounded-lg bg-surface-800 p-4">
          <p className="mb-2 text-[11px] text-surface-400">
            Your stream will be available at:
          </p>
          <code className="text-sm font-mono text-emerald-400">
            http://{serverConfig.host}:{serverConfig.port}{serverConfig.mount}
          </code>
          <p className="mt-2 text-[11px] text-surface-500">
            {serverConfig.protocol === 'icecast'
              ? 'Icecast 2 compatible (HTTP PUT protocol)'
              : 'SHOUTcast compatible (ICY protocol)'}
          </p>
        </div>
      </div>
    </div>
  )
}

function AudioSettings() {
  const audioDevices = useAppStore((s) => s.audioDevices)
  const selectedInputDevice = useAppStore((s) => s.selectedInputDevice)
  const setSelectedInputDevice = useAppStore((s) => s.setSelectedInputDevice)

  // Mock devices for UI preview
  const mockDevices = [
    { id: 'default', name: 'Default System Input', isInput: true, isDefault: true, channels: 2, sampleRates: [44100, 48000] },
    { id: 'mic-usb', name: 'USB Microphone (Blue Yeti)', isInput: true, isDefault: false, channels: 2, sampleRates: [44100, 48000, 96000] },
    { id: 'mixer-usb', name: 'USB Audio CODEC (Mixer)', isInput: true, isDefault: false, channels: 2, sampleRates: [44100, 48000] },
    { id: 'line-in', name: 'Line In (Built-in Audio)', isInput: true, isDefault: false, channels: 2, sampleRates: [44100, 48000] },
  ]

  const devices = audioDevices.length > 0 ? audioDevices : mockDevices

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
          Input Device
        </h3>
        <div className="space-y-3">
          {devices
            .filter((d) => d.isInput)
            .map((device) => (
              <label
                key={device.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                  selectedInputDevice === device.id
                    ? 'border-brand-500/50 bg-brand-600/10'
                    : 'border-surface-700/50 bg-surface-800/50 hover:border-surface-600'
                }`}
              >
                <input
                  type="radio"
                  name="inputDevice"
                  value={device.id}
                  checked={selectedInputDevice === device.id || (selectedInputDevice === '' && device.isDefault)}
                  onChange={() => setSelectedInputDevice(device.id)}
                  className="accent-brand-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{device.name}</p>
                  <p className="text-[11px] text-surface-500">
                    {device.channels} channels &middot;{' '}
                    {device.sampleRates.map((r) => `${r/1000}kHz`).join(', ')}
                  </p>
                </div>
                {device.isDefault && (
                  <span className="rounded bg-surface-700 px-2 py-0.5 text-[10px] text-surface-400">
                    Default
                  </span>
                )}
              </label>
            ))}
        </div>
      </div>

      <div className="glass-panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
          Audio Configuration
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-surface-400">
              Sample Rate
            </label>
            <select className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500">
              <option value="44100">44100 Hz (CD Quality)</option>
              <option value="48000">48000 Hz (Studio)</option>
              <option value="96000">96000 Hz (High-Res)</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-surface-400">
              Buffer Size
            </label>
            <select className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500">
              <option value="512">512 samples (Low latency)</option>
              <option value="1024">1024 samples</option>
              <option value="2048" selected>2048 samples (Recommended)</option>
              <option value="4096">4096 samples (Stable)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

function EncoderSettings() {
  const encoderFormat = useAppStore((s) => s.encoderFormat)
  const encoderBitrate = useAppStore((s) => s.encoderBitrate)
  const setEncoderFormat = useAppStore((s) => s.setEncoderFormat)
  const setEncoderBitrate = useAppStore((s) => s.setEncoderBitrate)

  const formats = [
    { id: 'mp3' as const, name: 'MP3', desc: 'Universal compatibility', ext: 'LAME' },
    { id: 'ogg' as const, name: 'OGG Vorbis', desc: 'Open source, great quality', ext: 'libvorbis' },
    { id: 'aac' as const, name: 'AAC', desc: 'Efficient, modern', ext: 'libfdk-aac' },
    { id: 'flac' as const, name: 'FLAC', desc: 'Lossless quality', ext: 'libflac' },
  ]

  const bitrates = [64, 96, 128, 160, 192, 224, 256, 320]

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
          Encoder Format
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => setEncoderFormat(fmt.id)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                encoderFormat === fmt.id
                  ? 'border-brand-500/50 bg-brand-600/10'
                  : 'border-surface-700/50 bg-surface-800/50 hover:border-surface-600'
              }`}
            >
              <p className="text-sm font-semibold text-white">{fmt.name}</p>
              <p className="text-[11px] text-surface-400">{fmt.desc}</p>
              <p className="mt-1 text-[10px] font-mono text-surface-500">
                {fmt.ext}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
          Bitrate
        </h3>
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
          Recommended: 192 kbps for MP3, 128 kbps for AAC, 160 kbps for OGG Vorbis
        </p>
      </div>
    </div>
  )
}

function AccountSettings() {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="mb-4 flex items-center gap-3">
          <Shield className="h-5 w-5 text-brand-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-surface-400">
            Subscription Plan
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <PlanCard
            name="Free"
            price="$0"
            period="forever"
            features={['1 streaming server', 'MP3 encoding', 'Basic mixer', '2 channels']}
            current={true}
          />
          <PlanCard
            name="Pro"
            price="$9.99"
            period="/month"
            features={['5 streaming servers', 'All encoders (MP3/OGG/AAC)', 'Full mixer + DSP', '8 channels', 'Recording', 'Auto-reconnect']}
            current={false}
            highlighted={true}
          />
          <PlanCard
            name="Studio"
            price="$24.99"
            period="/month"
            features={['Unlimited servers', 'All encoders + FLAC', 'Advanced DSP suite', '16 channels', 'Multi-output streaming', 'Priority support', 'Custom metadata API']}
            current={false}
          />
        </div>
      </div>
    </div>
  )
}

function PlanCard({
  name,
  price,
  period,
  features,
  current,
  highlighted,
}: {
  name: string
  price: string
  period: string
  features: string[]
  current?: boolean
  highlighted?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlighted
          ? 'border-brand-500/50 bg-brand-600/5'
          : 'border-surface-700/50 bg-surface-800/50'
      }`}
    >
      <h4 className="text-sm font-bold text-white">{name}</h4>
      <div className="mt-2">
        <span className="text-2xl font-bold text-white">{price}</span>
        <span className="text-[11px] text-surface-400">{period}</span>
      </div>
      <ul className="mt-4 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-[11px] text-surface-300">
            <div className="h-1 w-1 rounded-full bg-brand-500" />
            {f}
          </li>
        ))}
      </ul>
      <button
        className={`mt-4 w-full rounded-lg py-2 text-sm font-medium transition-colors ${
          current
            ? 'bg-surface-700 text-surface-400'
            : highlighted
            ? 'bg-brand-600 text-white hover:bg-brand-500'
            : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
        }`}
      >
        {current ? 'Current Plan' : 'Upgrade'}
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
          <p className="text-sm text-surface-400">
            Professional Internet Radio Streaming Software
          </p>
          <p className="text-[11px] text-surface-500">Version 0.1.0 (Alpha)</p>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-surface-500">Audio Engine</span>
          <span className="text-[11px] font-mono text-surface-300">Rust + CPAL</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-surface-500">UI Framework</span>
          <span className="text-[11px] font-mono text-surface-300">React + Electron</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-surface-500">Encoders</span>
          <span className="text-[11px] font-mono text-surface-300">LAME / libvorbis / libfdk-aac</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-surface-500">Protocols</span>
          <span className="text-[11px] font-mono text-surface-300">Icecast 2 / SHOUTcast</span>
        </div>
      </div>
    </div>
  )
}
