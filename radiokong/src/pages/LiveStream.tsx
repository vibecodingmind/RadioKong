import { useState } from 'react'
import {
  Radio,
  Square,
  Wifi,
  WifiOff,
  Music,
  User,
  Send,
  Server,
  Mic,
  Headphones,
  MonitorSpeaker,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Lock,
} from 'lucide-react'
import { useAppStore } from '../store'
import { useSubscriptionStore, hasFeature, getTierLimit } from '../store/subscription'
import { StereoVUMeter } from '../components/audio/VUMeter'
import { WaveformDisplay } from '../components/audio/WaveformDisplay'

export function LiveStream() {
  const isStreaming = useAppStore((s) => s.isStreaming)
  const isConnecting = useAppStore((s) => s.isConnecting)
  const streamStatus = useAppStore((s) => s.streamStatus)
  const serverConfig = useAppStore((s) => s.serverConfig)
  const encoderFormat = useAppStore((s) => s.encoderFormat)
  const encoderBitrate = useAppStore((s) => s.encoderBitrate)
  const currentMetadata = useAppStore((s) => s.currentMetadata)
  const mixerChannels = useAppStore((s) => s.mixerChannels)
  const masterVolume = useAppStore((s) => s.masterVolume)
  const selectedInputDevice = useAppStore((s) => s.selectedInputDevice)
  const selectedOutputDevice = useAppStore((s) => s.selectedOutputDevice)
  const audioDevices = useAppStore((s) => s.audioDevices)
  const additionalServers = useAppStore((s) => s.additionalServers)
  const setStreaming = useAppStore((s) => s.setStreaming)
  const setConnecting = useAppStore((s) => s.setConnecting)
  const setStreamStatus = useAppStore((s) => s.setStreamStatus)
  const setMetadata = useAppStore((s) => s.setMetadata)
  const subscriptionTier = useSubscriptionStore((s) => s.tier)

  const [metadataTitle, setMetadataTitle] = useState(currentMetadata.title)
  const [metadataArtist, setMetadataArtist] = useState(currentMetadata.artist)
  const [showServerConfig, setShowServerConfig] = useState(!isStreaming)
  const [showDeviceConfig, setShowDeviceConfig] = useState(false)
  const [showMultiServer, setShowMultiServer] = useState(false)

  const inputDevices = audioDevices.filter((d) => d.isInput)
  const outputDevices = audioDevices.filter((d) => !d.isInput)

  // Mock devices for development (replaced when engine reports real devices)
  const mockInputDevices = [
    { id: 'default', name: 'Default System Input', isInput: true, isDefault: true, channels: 2, sampleRates: [44100, 48000] },
    { id: 'mic-usb', name: 'USB Microphone (Blue Yeti)', isInput: true, isDefault: false, channels: 2, sampleRates: [44100, 48000, 96000] },
    { id: 'mixer-usb', name: 'USB Audio CODEC (Mixer)', isInput: true, isDefault: false, channels: 2, sampleRates: [44100, 48000] },
  ]
  const mockOutputDevices = [
    { id: 'default-out', name: 'Default System Output', isInput: false, isDefault: true, channels: 2, sampleRates: [44100, 48000] },
    { id: 'headphones-usb', name: 'USB Headphones', isInput: false, isDefault: false, channels: 2, sampleRates: [44100, 48000] },
  ]

  const inputs = inputDevices.length > 0 ? inputDevices : mockInputDevices
  const outputs = outputDevices.length > 0 ? outputDevices : mockOutputDevices

  const canMultiServer = subscriptionTier !== 'free'

  const handleConnect = async () => {
    if (isStreaming) {
      try {
        await window.electronAPI?.engineStop()
        setStreaming(false)
        setStreamStatus(null)
      } catch (err) {
        console.error('Failed to stop stream:', err)
      }
      return
    }

    setConnecting(true)
    try {
      const config = useAppStore.getState().getEngineConfig()
      await window.electronAPI?.engineStart(config)

      setTimeout(() => {
        setConnecting(false)
        setStreaming(true)
        setStreamStatus({
          connected: true,
          bytesSent: 0,
          uptime: 0,
          bitrate: encoderBitrate,
          format: encoderFormat,
          server: `${serverConfig.host}:${serverConfig.port}`,
          mount: serverConfig.mount,
        })
      }, 1500)
    } catch (err) {
      console.error('Failed to start stream:', err)
      setConnecting(false)
    }
  }

  const handleUpdateMetadata = () => {
    setMetadata({ title: metadataTitle, artist: metadataArtist })
    window.electronAPI?.engineCommand({
      type: 'set_metadata',
      title: metadataTitle,
      artist: metadataArtist,
    })
  }

  // Get master VU levels from mixer channels
  const masterVU = {
    left: Math.max(...mixerChannels.map((ch) => ch.vuLevel.left)) * masterVolume,
    right: Math.max(...mixerChannels.map((ch) => ch.vuLevel.right)) * masterVolume,
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Live Stream</h2>
          <p className="text-sm text-surface-400">
            Control your live broadcast — configure server, devices, and go live
          </p>
        </div>
        <div className="flex items-center gap-3">
          {subscriptionTier === 'free' && (
            <a
              href="#/settings"
              className="flex items-center gap-2 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs font-medium text-brand-400 transition-colors hover:bg-brand-500/20"
            >
              <Lock className="h-3.5 w-3.5" />
              Upgrade for Multi-Server & DSP
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Stream Control */}
        <div className="col-span-2 space-y-6">
          {/* Connection Panel */}
          <div className="glass-panel p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isStreaming ? (
                  <Wifi className="h-5 w-5 text-emerald-400" />
                ) : (
                  <WifiOff className="h-5 w-5 text-surface-500" />
                )}
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Stream Connection
                  </h3>
                  <p className="text-[11px] text-surface-400">
                    {isStreaming
                      ? `Connected to ${serverConfig.host}:${serverConfig.port}${serverConfig.mount}`
                      : 'Not connected — configure server below'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isStreaming && streamStatus && (
                  <div className="flex items-center gap-4 text-[11px] text-surface-400">
                    <span>{streamStatus.bitrate}kbps</span>
                    <span>{streamStatus.format.toUpperCase()}</span>
                    <span>{formatUptime(streamStatus.uptime)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Big Connect Button */}
            <div className="flex flex-col items-center gap-6">
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className={`group relative flex h-32 w-32 items-center justify-center rounded-full transition-all duration-300 ${
                  isStreaming
                    ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 glow-red'
                    : isConnecting
                    ? 'bg-yellow-600/20 text-yellow-400 animate-pulse'
                    : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 hover:scale-105'
                } disabled:cursor-not-allowed`}
              >
                <div
                  className={`absolute inset-0 rounded-full ${
                    isStreaming
                      ? 'bg-red-600/5 animate-ping'
                      : ''
                  }`}
                />
                {isStreaming ? (
                  <Square className="h-10 w-10" fill="currentColor" />
                ) : (
                  <Radio className="h-10 w-10" />
                )}
              </button>
              <span className="text-sm font-medium text-surface-300">
                {isStreaming
                  ? 'Disconnect'
                  : isConnecting
                  ? 'Connecting...'
                  : 'Go Live'}
              </span>
            </div>
          </div>

          {/* Server Configuration - Collapsible */}
          <div className="glass-panel overflow-hidden">
            <button
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-surface-800/30"
            >
              <div className="flex items-center gap-3">
                <Server className="h-4 w-4 text-brand-400" />
                <h3 className="text-sm font-semibold text-white">Server Configuration</h3>
                <span className="text-[11px] text-surface-400">
                  {serverConfig.protocol.toUpperCase()}://{serverConfig.username}@{serverConfig.host}:{serverConfig.port}{serverConfig.mount}
                </span>
              </div>
              {showServerConfig ? (
                <ChevronUp className="h-4 w-4 text-surface-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-surface-400" />
              )}
            </button>

            {showServerConfig && (
              <div className="border-t border-surface-800 p-6 pt-4">
                <ServerConfigForm />
              </div>
            )}
          </div>

          {/* Input/Output Device Selection - Collapsible */}
          <div className="glass-panel overflow-hidden">
            <button
              onClick={() => setShowDeviceConfig(!showDeviceConfig)}
              className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-surface-800/30"
            >
              <div className="flex items-center gap-3">
                <MonitorSpeaker className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-white">Audio Devices</h3>
                <span className="text-[11px] text-surface-400">
                  Input: {inputs.find((d) => d.id === selectedInputDevice)?.name || 'Default'} &middot; Output: {outputs.find((d) => d.id === selectedOutputDevice)?.name || 'Default'}
                </span>
              </div>
              {showDeviceConfig ? (
                <ChevronUp className="h-4 w-4 text-surface-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-surface-400" />
              )}
            </button>

            {showDeviceConfig && (
              <div className="border-t border-surface-800 p-6 pt-4">
                <DeviceSelection inputs={inputs} outputs={outputs} />
              </div>
            )}
          </div>

          {/* Multi-Server Streaming - Collapsible (Pro/Studio only) */}
          <div className="glass-panel overflow-hidden">
            <button
              onClick={() => setShowMultiServer(!showMultiServer)}
              className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-surface-800/30"
            >
              <div className="flex items-center gap-3">
                <Server className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Multi-Server Output</h3>
                <span className="text-[11px] text-surface-400">
                  {additionalServers.filter((s) => s.enabled).length} additional server(s)
                </span>
                {!canMultiServer && (
                  <span className="rounded bg-surface-700 px-2 py-0.5 text-[9px] font-bold uppercase text-surface-400">
                    PRO+
                  </span>
                )}
              </div>
              {showMultiServer ? (
                <ChevronUp className="h-4 w-4 text-surface-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-surface-400" />
              )}
            </button>

            {showMultiServer && (
              <div className="border-t border-surface-800 p-6 pt-4">
                {canMultiServer ? (
                  <MultiServerConfig />
                ) : (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <Lock className="h-8 w-8 text-surface-600" />
                    <p className="text-sm text-surface-400">
                      Stream to multiple servers simultaneously with Pro or Studio
                    </p>
                    <a
                      href="#/settings"
                      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500"
                    >
                      Upgrade via PesaPal
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Waveform & VU Meters */}
          <div className="glass-panel p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
              Audio Monitor
            </h3>
            <div className="flex items-end gap-6">
              <div className="flex-1">
                <WaveformDisplay
                  data={useAppStore((s) => s.waveformData) ? new Float32Array(useAppStore.getState().waveformData!) : null}
                  width={500}
                  height={100}
                  color={isStreaming ? '#10b981' : '#64748b'}
                />
              </div>
              <StereoVUMeter
                leftLevel={isStreaming ? masterVU.left : 0}
                rightLevel={isStreaming ? masterVU.right : 0}
                height={100}
                label="Master"
              />
            </div>
          </div>
        </div>

        {/* Right Panel: Metadata & Info */}
        <div className="space-y-6">
          {/* Metadata Update */}
          <div className="glass-panel p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
              Track Metadata
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-[11px] font-medium text-surface-400">
                  <Music className="h-3.5 w-3.5" /> Title
                </label>
                <input
                  type="text"
                  value={metadataTitle}
                  onChange={(e) => setMetadataTitle(e.target.value)}
                  placeholder="Song or show title"
                  className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-white placeholder-surface-500 outline-none transition-colors focus:border-brand-500"
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-[11px] font-medium text-surface-400">
                  <User className="h-3.5 w-3.5" /> Artist
                </label>
                <input
                  type="text"
                  value={metadataArtist}
                  onChange={(e) => setMetadataArtist(e.target.value)}
                  placeholder="Artist name"
                  className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-white placeholder-surface-500 outline-none transition-colors focus:border-brand-500"
                />
              </div>
              <button
                onClick={handleUpdateMetadata}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
              >
                <Send className="h-4 w-4" />
                Update Metadata
              </button>
            </div>
          </div>

          {/* Stream Info Summary */}
          <div className="glass-panel p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
              Stream Info
            </h3>
            <div className="space-y-3">
              <InfoRow label="Protocol" value={serverConfig.protocol.toUpperCase()} />
              <InfoRow label="Server" value={`${serverConfig.host}:${serverConfig.port}`} />
              <InfoRow label="Mount Point" value={serverConfig.mount} />
              <InfoRow label="Username" value={serverConfig.username || '(none)'} />
              <InfoRow label="Format" value={encoderFormat.toUpperCase()} />
              <InfoRow label="Bitrate" value={`${encoderBitrate} kbps`} />
              <InfoRow label="Sample Rate" value={`${useAppStore.getState().sampleRate} Hz`} />
              <InfoRow label="Channels" value={useAppStore.getState().channels === 2 ? 'Stereo' : 'Mono'} />
              <InfoRow label="Auto-Reconnect" value={hasFeature(subscriptionTier, 'autoReconnect') ? 'Enabled (5 retries)' : 'Disabled'} />
            </div>
          </div>

          {/* Quick Subscription Status */}
          <SubscriptionBadge />
        </div>
      </div>
    </div>
  )
}

/** Server configuration form — full editing including username */
function ServerConfigForm() {
  const serverConfig = useAppStore((s) => s.serverConfig)
  const setServerConfig = useAppStore((s) => s.setServerConfig)

  return (
    <div className="space-y-4">
      {/* Protocol selector */}
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
              ? 'Usually "source" for Icecast'
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

      {/* Connection preview */}
      <div className="rounded-lg bg-surface-800 p-3">
        <p className="mb-1 text-[10px] text-surface-500">Your stream will be available at:</p>
        <code className="text-xs font-mono text-emerald-400">
          http://{serverConfig.host}:{serverConfig.port}{serverConfig.mount}
        </code>
        <p className="mt-1 text-[10px] text-surface-500">
          Auth: {serverConfig.username}:{'*'.repeat(serverConfig.password.length)} &middot; {serverConfig.protocol === 'icecast' ? 'Icecast 2 (HTTP PUT)' : 'SHOUTcast (ICY)'}
        </p>
      </div>
    </div>
  )
}

/** Device selection form */
function DeviceSelection({ inputs, outputs }: { inputs: any[]; outputs: any[] }) {
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

  return (
    <div className="space-y-6">
      {/* Input Device */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
          <Mic className="h-4 w-4 text-emerald-400" />
          Input Device (Capture)
        </h4>
        <div className="space-y-2">
          {inputs.map((device) => (
            <label
              key={device.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                selectedInputDevice === device.id || (selectedInputDevice === '' && device.isDefault)
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
                  {device.channels} ch &middot; {device.sampleRates.map((r: number) => `${r/1000}kHz`).join(', ')}
                </p>
              </div>
              {device.isDefault && (
                <span className="rounded bg-surface-700 px-2 py-0.5 text-[10px] text-surface-400">Default</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Output Device */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
          <Headphones className="h-4 w-4 text-blue-400" />
          Output Device (Monitor)
        </h4>
        <div className="space-y-2">
          {outputs.map((device) => (
            <label
              key={device.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
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
                  {device.channels} ch &middot; {device.sampleRates.map((r: number) => `${r/1000}kHz`).join(', ')}
                </p>
              </div>
              {device.isDefault && (
                <span className="rounded bg-surface-700 px-2 py-0.5 text-[10px] text-surface-400">Default</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Audio Config */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-surface-400">Sample Rate</label>
          <select
            value={sampleRate}
            onChange={(e) => setSampleRate(parseInt(e.target.value))}
            className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
          >
            <option value={44100}>44100 Hz (CD)</option>
            <option value={48000}>48000 Hz (Studio)</option>
            <option value={96000}>96000 Hz (Hi-Res)</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-surface-400">Buffer Size</label>
          <select
            value={bufferSize}
            onChange={(e) => setBufferSize(parseInt(e.target.value))}
            className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
          >
            <option value={512}>512 (Low latency)</option>
            <option value={1024}>1024</option>
            <option value={2048}>2048 (Recommended)</option>
            <option value={4096}>4096 (Stable)</option>
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
    </div>
  )
}

/** Multi-server configuration */
function MultiServerConfig() {
  const additionalServers = useAppStore((s) => s.additionalServers)
  const addAdditionalServer = useAppStore((s) => s.addAdditionalServer)
  const updateAdditionalServer = useAppStore((s) => s.updateAdditionalServer)
  const removeAdditionalServer = useAppStore((s) => s.removeAdditionalServer)
  const subscriptionTier = useSubscriptionStore((s) => s.tier)
  const maxServers = getTierLimit(subscriptionTier, 'maxServers')

  const handleAddServer = () => {
    const id = `srv-${Date.now()}`
    addAdditionalServer({
      id,
      host: '',
      port: 8000,
      mount: '/live',
      username: 'source',
      password: '',
      protocol: 'icecast',
      enabled: true,
      label: `Server ${additionalServers.length + 2}`,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-surface-400">
          {additionalServers.length} of {maxServers === Infinity ? 'unlimited' : maxServers - 1} additional servers used
        </p>
        <button
          onClick={handleAddServer}
          disabled={additionalServers.length >= (maxServers - 1)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Server
        </button>
      </div>

      {additionalServers.length === 0 && (
        <div className="rounded-lg border border-dashed border-surface-700 p-6 text-center">
          <Server className="mx-auto h-8 w-8 text-surface-600" />
          <p className="mt-2 text-sm text-surface-400">No additional servers configured</p>
          <p className="text-[11px] text-surface-500">Add more servers to stream to multiple destinations simultaneously</p>
        </div>
      )}

      {additionalServers.map((server) => (
        <div key={server.id} className="rounded-lg border border-surface-700/50 bg-surface-800/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={server.label}
                onChange={(e) => updateAdditionalServer(server.id, { label: e.target.value })}
                className="rounded border-none bg-transparent text-sm font-medium text-white outline-none"
                placeholder="Server label"
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

          <div className="grid grid-cols-2 gap-3">
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
              <label className="mb-1 block text-[10px] text-surface-500">Port</label>
              <input
                type="number"
                value={server.port}
                onChange={(e) => updateAdditionalServer(server.id, { port: parseInt(e.target.value) || 8000 })}
                className="w-full rounded border border-surface-700 bg-surface-900 px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-surface-500">Mount</label>
              <input
                type="text"
                value={server.mount}
                onChange={(e) => updateAdditionalServer(server.id, { mount: e.target.value })}
                className="w-full rounded border border-surface-700 bg-surface-900 px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-surface-500">Protocol</label>
              <select
                value={server.protocol}
                onChange={(e) => updateAdditionalServer(server.id, { protocol: e.target.value as 'icecast' | 'shoutcast' })}
                className="w-full rounded border border-surface-700 bg-surface-900 px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500"
              >
                <option value="icecast">Icecast</option>
                <option value="shoutcast">SHOUTcast</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-surface-500">Username</label>
              <input
                type="text"
                value={server.username}
                onChange={(e) => updateAdditionalServer(server.id, { username: e.target.value })}
                placeholder="source"
                className="w-full rounded border border-surface-700 bg-surface-900 px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-surface-500">Password</label>
              <input
                type="password"
                value={server.password}
                onChange={(e) => updateAdditionalServer(server.id, { password: e.target.value })}
                className="w-full rounded border border-surface-700 bg-surface-900 px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Subscription badge shown on the right panel */
function SubscriptionBadge() {
  const tier = useSubscriptionStore((s) => s.tier)

  const tierInfo: Record<string, { label: string; color: string; bg: string }> = {
    free: { label: 'Free', color: 'text-surface-400', bg: 'bg-surface-800' },
    pro: { label: 'Pro', color: 'text-brand-400', bg: 'bg-brand-600/10' },
    studio: { label: 'Studio', color: 'text-purple-400', bg: 'bg-purple-600/10' },
    enterprise: { label: 'Enterprise', color: 'text-amber-400', bg: 'bg-amber-600/10' },
  }

  const info = tierInfo[tier] || tierInfo.free

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-surface-500">Subscription</p>
          <p className={`text-lg font-bold ${info.color}`}>{info.label}</p>
        </div>
        <div className={`rounded-lg ${info.bg} px-3 py-1.5`}>
          <span className={`text-xs font-bold ${info.color}`}>
            {tier.toUpperCase()}
          </span>
        </div>
      </div>
      {tier === 'free' && (
        <a
          href="#/settings"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-500"
        >
          Upgrade via PesaPal
        </a>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-surface-500">{label}</span>
      <span className="text-[11px] font-mono text-surface-300">{value}</span>
    </div>
  )
}

function formatUptime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
