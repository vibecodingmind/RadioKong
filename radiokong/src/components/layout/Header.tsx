import { Minus, Square, X } from 'lucide-react'
import { useAppStore } from '../../store'

// Detect macOS for native traffic lights
const isMac = navigator.userAgent.includes('Mac')

export function Header() {
  const isStreaming = useAppStore((s) => s.isStreaming)
  const streamStatus = useAppStore((s) => s.streamStatus)

  const handleMinimize = () => window.electronAPI?.minimizeWindow()
  const handleMaximize = () => window.electronAPI?.maximizeWindow()
  const handleClose = () => window.electronAPI?.closeWindow()

  return (
    <header className="drag-region flex h-14 items-center justify-between border-b border-surface-800 bg-surface-950/90 px-4">
      {/* Left: macOS traffic light space + Stream info */}
      <div className="no-drag flex items-center gap-4">
        {/* macOS: leave space for native traffic lights */}
        {isMac && <div className="w-20" />}
        {isStreaming && streamStatus && (
          <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 px-3 py-1.5">
            <div className="status-live" />
            <span className="text-xs font-medium text-emerald-400">
              LIVE
            </span>
            <span className="text-xs text-emerald-400/70">
              {streamStatus.bitrate}kbps {streamStatus.format.toUpperCase()}
            </span>
            <span className="text-xs text-emerald-400/70">
              {formatUptime(streamStatus.uptime)}
            </span>
          </div>
        )}
      </div>

      {/* Center: Title (drag region) */}
      <div className="absolute left-1/2 -translate-x-1/2 text-xs text-surface-500">
        RadioKong
      </div>

      {/* Right: Window controls (hidden on macOS — native traffic lights) */}
      {!isMac && (
        <div className="no-drag flex items-center gap-1">
          <button
            onClick={handleMinimize}
            className="flex h-8 w-8 items-center justify-center rounded-md text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={handleMaximize}
            className="flex h-8 w-8 items-center justify-center rounded-md text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-surface-400 transition-colors hover:bg-red-600 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  )
}

function formatUptime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}
