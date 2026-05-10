import {
  Radio,
  Mic,
  Clock,
  ArrowUpRight,
  Signal,
  HardDrive,
  Activity,
} from 'lucide-react'
import { useAppStore } from '../store'

export function Dashboard() {
  const isStreaming = useAppStore((s) => s.isStreaming)
  const streamStatus = useAppStore((s) => s.streamStatus)
  const serverConfig = useAppStore((s) => s.serverConfig)
  const encoderFormat = useAppStore((s) => s.encoderFormat)
  const encoderBitrate = useAppStore((s) => s.encoderBitrate)
  const isRecording = useAppStore((s) => s.isRecording)
  const recordings = useAppStore((s) => s.recordings)
  const currentMetadata = useAppStore((s) => s.currentMetadata)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-sm text-surface-400">
            Monitor your streaming status and quick actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              isStreaming
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-surface-800 text-surface-400'
            }`}
          >
            <div className={isStreaming ? 'status-live' : 'status-offline'} />
            {isStreaming ? 'Live on Air' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={Radio}
          label="Stream Status"
          value={isStreaming ? 'Connected' : 'Disconnected'}
          detail={
            isStreaming
              ? `${serverConfig.protocol.toUpperCase()} ${serverConfig.host}:${serverConfig.port}`
              : 'Not streaming'
          }
          color={isStreaming ? 'emerald' : 'slate'}
        />
        <StatCard
          icon={Signal}
          label="Bitrate"
          value={`${encoderBitrate} kbps`}
          detail={encoderFormat.toUpperCase()}
          color="blue"
        />
        <StatCard
          icon={Clock}
          label="Uptime"
          value={
            streamStatus
              ? formatUptime(streamStatus.uptime)
              : '--:--:--'
          }
          detail={streamStatus ? 'Stream duration' : 'Not active'}
          color="purple"
        />
        <StatCard
          icon={HardDrive}
          label="Recording"
          value={isRecording ? 'Active' : 'Stopped'}
          detail={`${recordings.length} recordings`}
          color={isRecording ? 'amber' : 'slate'}
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="col-span-2 rounded-xl border border-surface-700/50 bg-surface-900/80 p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
            Quick Actions
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <QuickAction
              icon={Radio}
              label="Go Live"
              description="Start streaming to your server"
              color="emerald"
              href="/stream"
            />
            <QuickAction
              icon={Mic}
              label="Open Mixer"
              description="Adjust audio levels and channels"
              color="blue"
              href="/mixer"
            />
            <QuickAction
              icon={HardDrive}
              label="Record"
              description="Start recording your broadcast"
              color="amber"
              href="/recordings"
            />
          </div>
        </div>

        {/* Now Playing / Metadata */}
        <div className="rounded-xl border border-surface-700/50 bg-surface-900/80 p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
            Now Playing
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] text-surface-500">Title</p>
              <p className="text-sm font-medium text-white">
                {currentMetadata.title || 'No title set'}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-surface-500">Artist</p>
              <p className="text-sm font-medium text-white">
                {currentMetadata.artist || 'No artist set'}
              </p>
            </div>
            <div className="rounded-lg bg-surface-800 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-surface-500">Server</span>
                <span className="text-[11px] font-mono text-surface-300">
                  {serverConfig.host}:{serverConfig.port}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-surface-500">Mount</span>
                <span className="text-[11px] font-mono text-surface-300">
                  {serverConfig.mount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-surface-500">Protocol</span>
                <span className="text-[11px] font-mono text-surface-300">
                  {serverConfig.protocol.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="rounded-xl border border-surface-700/50 bg-surface-900/80 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-surface-400">
            Activity
          </h3>
          <Activity className="h-4 w-4 text-surface-500" />
        </div>
        <div className="space-y-3">
          <LogEntry
            time="System"
            message="RadioKong initialized. Ready to stream."
            type="info"
          />
          <LogEntry
            time="Audio"
            message="Default audio device detected. Configure in Settings."
            type="info"
          />
          <LogEntry
            time="Server"
            message="No server configured. Go to Settings to set up your streaming server."
            type="warning"
          />
        </div>
      </div>
    </div>
  )
}

// Sub-components
function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  color,
}: {
  icon: any
  label: string
  value: string
  detail: string
  color: string
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    slate: 'text-surface-400 bg-surface-800',
  }
  const iconColor = colorMap[color] || colorMap.slate

  return (
    <div className="rounded-xl border border-surface-700/50 bg-surface-900/80 p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-surface-500">
          {label}
        </span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[11px] text-surface-500">{detail}</p>
    </div>
  )
}

function QuickAction({
  icon: Icon,
  label,
  description,
  color,
  href,
}: {
  icon: any
  label: string
  description: string
  color: string
  href: string
}) {
  const borderColor: Record<string, string> = {
    emerald: 'hover:border-emerald-500/30',
    blue: 'hover:border-blue-500/30',
    amber: 'hover:border-amber-500/30',
  }
  const iconBg: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-400',
    amber: 'bg-amber-500/10 text-amber-400',
  }

  return (
    <a
      href={`#${href}`}
      className={`group flex flex-col gap-3 rounded-xl border border-surface-700/50 bg-surface-800/50 p-5 transition-all duration-200 ${borderColor[color]}`}
    >
      <div className="flex items-center justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg[color]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-surface-600 transition-colors group-hover:text-surface-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-[11px] text-surface-500">{description}</p>
      </div>
    </a>
  )
}

function LogEntry({
  time,
  message,
  type,
}: {
  time: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
}) {
  const dotColor: Record<string, string> = {
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    success: 'bg-emerald-500',
  }

  return (
    <div className="flex items-start gap-3">
      <div className={`mt-1.5 h-2 w-2 rounded-full ${dotColor[type]}`} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-surface-400">
            {time}
          </span>
        </div>
        <p className="text-sm text-surface-300">{message}</p>
      </div>
    </div>
  )
}

function formatUptime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
