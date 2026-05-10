import { useState } from 'react'
import {
  CircleDot,
  Square,
  Play,
  Trash2,
  Download,
  Clock,
  FileAudio,
  FolderOpen,
} from 'lucide-react'
import { useAppStore } from '../store'

export function Recordings() {
  const isRecording = useAppStore((s) => s.isRecording)
  const recordings = useAppStore((s) => s.recordings)
  const setRecording = useAppStore((s) => s.setRecording)
  const removeRecording = async (id: string) => {
    // Find the recording to get its file path
    const rec = recordings.find((r) => r.id === id)
    if (rec?.path && window.electronAPI?.deleteFile) {
      try {
        await window.electronAPI.deleteFile(rec.path)
      } catch (err) {
        console.error('Failed to delete recording file:', err)
      }
    }
    // Remove from store
    useAppStore.setState((state) => ({
      recordings: state.recordings.filter((r) => r.id !== id),
    }))
  }

  const [recordPath, setRecordPath] = useState('~/Recordings/RadioKong')
  const [recordFormat, setRecordFormat] = useState<'wav' | 'mp3' | 'flac'>('wav')

  const handleToggleRecording = async () => {
    if (isRecording) {
      await window.electronAPI?.engineCommand({ type: 'stop_recording' })
      setRecording(false)
    } else {
      await window.electronAPI?.engineCommand({
        type: 'start_recording',
        path: recordPath,
        format: recordFormat,
      })
      setRecording(true)
    }
  }

  const handleBrowse = async () => {
    if (!window.electronAPI?.showOpenDialog) return
    try {
      const result = await window.electronAPI.showOpenDialog({
        title: 'Select Recording Location',
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: 'Select Folder',
      })
      if (result && !result.canceled && result.filePaths.length > 0) {
        setRecordPath(result.filePaths[0])
      }
    } catch (err) {
      console.error('Browse dialog failed:', err)
    }
  }

  const handlePlay = async (rec: any) => {
    if (!window.electronAPI?.openPath) return
    try {
      await window.electronAPI.openPath(rec.path)
    } catch (err) {
      console.error('Failed to play recording:', err)
    }
  }

  const handleShowInFolder = async (rec: any) => {
    if (!window.electronAPI?.showItemInFolder) return
    try {
      await window.electronAPI.showItemInFolder(rec.path)
    } catch (err) {
      console.error('Failed to show in folder:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Recordings</h2>
          <p className="text-sm text-surface-400">
            Record and manage your broadcast archives
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recording Control */}
        <div className="col-span-1 space-y-6">
          {/* Record Button */}
          <div className="glass-panel p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
              Recording Control
            </h3>
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleToggleRecording}
                className={`flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 ${
                  isRecording
                    ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 glow-red'
                    : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-surface-200'
                }`}
              >
                {isRecording ? (
                  <Square className="h-8 w-8" fill="currentColor" />
                ) : (
                  <CircleDot className="h-8 w-8" />
                )}
              </button>
              <span className="text-sm font-medium text-surface-300">
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </span>
              {isRecording && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  <span className="text-[11px] text-red-400">Recording...</span>
                </div>
              )}
            </div>
          </div>

          {/* Recording Settings */}
          <div className="glass-panel p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-400">
              Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-surface-400">
                  Save Location
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={recordPath}
                    onChange={(e) => setRecordPath(e.target.value)}
                    className="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-white placeholder-surface-500 outline-none focus:border-brand-500"
                  />
                  <button
                    onClick={handleBrowse}
                    className="flex items-center gap-1.5 rounded-lg bg-surface-700 px-3 py-2 text-sm text-surface-300 hover:bg-surface-600"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Browse
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-surface-400">
                  Format
                </label>
                <div className="flex gap-2">
                  {(['wav', 'mp3', 'flac'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setRecordFormat(fmt)}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                        recordFormat === fmt
                          ? 'bg-brand-600 text-white'
                          : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
                {recordFormat !== 'wav' && (
                  <p className="mt-2 text-[10px] text-amber-400/80">
                    MP3/FLAC recording uses WAV format internally — full encoder support coming soon
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recordings List */}
        <div className="col-span-2 glass-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-surface-400">
              Recording Library
            </h3>
            <span className="text-[11px] text-surface-500">
              {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
            </span>
          </div>

          {recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FileAudio className="mb-4 h-12 w-12 text-surface-700" />
              <p className="text-sm text-surface-400">No recordings yet</p>
              <p className="text-[11px] text-surface-600">
                Start recording during your broadcast to save archives
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recordings.map((rec) => (
                <RecordingItem
                  key={rec.id}
                  recording={rec}
                  onPlay={handlePlay}
                  onShowInFolder={handleShowInFolder}
                  onDelete={removeRecording}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RecordingItem({
  recording,
  onPlay,
  onShowInFolder,
  onDelete,
}: {
  recording: any
  onPlay: (rec: any) => void
  onShowInFolder: (rec: any) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-surface-700/50 bg-surface-800/50 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
        <FileAudio className="h-5 w-5 text-purple-400" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{recording.filename}</p>
        <p className="text-[11px] text-surface-500">
          {recording.format.toUpperCase()} &middot; {formatFileSize(recording.fileSize)}
        </p>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-surface-500">
        <Clock className="h-3 w-3" />
        {formatDuration(recording.duration)}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPlay(recording)}
          className="rounded p-1.5 text-surface-400 transition-colors hover:bg-emerald-600/20 hover:text-emerald-400"
          title="Play with system player"
        >
          <Play className="h-4 w-4" />
        </button>
        <button
          onClick={() => onShowInFolder(recording)}
          className="rounded p-1.5 text-surface-400 transition-colors hover:bg-blue-600/20 hover:text-blue-400"
          title="Show in folder"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(recording.id)}
          className="rounded p-1.5 text-surface-400 transition-colors hover:bg-red-600/20 hover:text-red-400"
          title="Delete recording"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
