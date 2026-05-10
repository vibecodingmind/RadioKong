import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useAppStore } from '../../store'

/**
 * A global toast notification that appears when the Rust engine reports an error.
 * Examples: "Cannot add channel: not streaming", "Server connection failed", etc.
 * Auto-dismisses after 8 seconds (matching the store's timeout).
 */
export function EngineErrorToast() {
  const engineError = useAppStore((s) => s.engineError)
  const setEngineError = useAppStore((s) => s.setEngineError)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (engineError) {
      setVisible(true)
    } else {
      // Fade out
      const timer = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [engineError])

  if (!visible && !engineError) return null

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-md transition-all duration-300 ${
        engineError ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/90 px-5 py-4 shadow-2xl backdrop-blur-sm">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-200">Engine Error</p>
          <p className="mt-1 text-xs text-red-300/80">{engineError}</p>
        </div>
        <button
          onClick={() => setEngineError(null)}
          className="flex-shrink-0 rounded p-1 text-red-400 transition-colors hover:bg-red-800/50 hover:text-red-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
