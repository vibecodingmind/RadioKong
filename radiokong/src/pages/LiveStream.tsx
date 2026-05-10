import { useState } from 'react'
import {
  Radio,
  Square,
  Settings,
  Wifi,
  WifiOff,
  RefreshCw,
  Music,
  User,
  Send,
} from 'lucide-react'
import { useAppStore } from '../store'
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
  const masterMuted = useAppStore((s) => s.masterMuted)
  const setStreaming = useAppStore((s) => s.setStreaming)
  const setConnecting = useAppStore((s) => s.setConnecting)
  const setStreamStatus = useAppStore((s) => s.setStreamStatus)
  const setMetadata = useAppStore((s) => s.setMetadata)

  const [metadataTitle, setMetadataTitle] = useState(currentMetadata.title)
  const [metadataArtist, setMetadataArtist] = useState(currentMetadata.artist)

  const handleConnect = async () => {
    if (isStreaming) {
      // Disconnect
      try {
        await window.electronAPI?.engineStop()
        setStreaming(false)
        setStreamStatus(null)
      } catch (err) {
        console.error('Failed to stop stream:', err)
      }
      return
    }

    // Connect
    setConnecting(true)
    try {
      const config = useAppStore.getState().getEngineConfig()
      await window.electronAPI?.engineStart(config)

      // Simulate connection for now (will be replaced by real engine events)
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
            Control your live broadcast stream
          </p>
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
                      : 'Not connected'}
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

          {/* Waveform & VU Meters */}
          <div className="glass-panel p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
              Audio Monitor
            </h3>
            <div className="flex items-end gap-6">
              <div className="flex-1">
                <WaveformDisplay
                  data={null}
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

          {/* Stream Info */}
          <div className="glass-panel p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
              Stream Info
            </h3>
            <div className="space-y-3">
              <InfoRow label="Protocol" value={serverConfig.protocol.toUpperCase()} />
              <InfoRow label="Server" value={`${serverConfig.host}:${serverConfig.port}`} />
              <InfoRow label="Mount Point" value={serverConfig.mount} />
              <InfoRow label="Format" value={encoderFormat.toUpperCase()} />
              <InfoRow label="Bitrate" value={`${encoderBitrate} kbps`} />
              <InfoRow label="Sample Rate" value="44100 Hz" />
              <InfoRow label="Channels" value="Stereo" />
            </div>
          </div>
        </div>
      </div>
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
