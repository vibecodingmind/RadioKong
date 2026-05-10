import { Minus, Square, X, User, LogOut, CreditCard, Zap, Shield, Crown, Building2, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../store'
import { useAuthStore } from '../../store/auth'
import { useSubscriptionStore } from '../../store/subscription'
import type { SubscriptionTier } from '../../store/subscription'

// Detect macOS for native traffic lights
const isMac = navigator.userAgent.includes('Mac')

const tierIcons: Record<SubscriptionTier, any> = {
  free: Zap,
  pro: Shield,
  studio: Crown,
  enterprise: Building2,
}

export function Header() {
  const isStreaming = useAppStore((s) => s.isStreaming)
  const streamStatus = useAppStore((s) => s.streamStatus)
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)
  const tier = useSubscriptionStore((s) => s.tier)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleMinimize = () => window.electronAPI?.minimizeWindow()
  const handleMaximize = () => window.electronAPI?.maximizeWindow()
  const handleClose = () => window.electronAPI?.closeWindow()

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [showUserMenu])

  const TierIcon = tierIcons[tier]

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

      {/* Right: User menu + Window controls */}
      <div className="no-drag flex items-center gap-3">
        {/* Subscription tier badge */}
        <a
          href="#/settings"
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase transition-colors ${
            tier === 'free'
              ? 'bg-surface-800 text-surface-400 hover:bg-surface-700'
              : tier === 'pro'
              ? 'bg-brand-600/10 text-brand-400 hover:bg-brand-600/20'
              : tier === 'studio'
              ? 'bg-purple-600/10 text-purple-400 hover:bg-purple-600/20'
              : 'bg-amber-600/10 text-amber-400 hover:bg-amber-600/20'
          }`}
        >
          <TierIcon className="h-3 w-3" />
          {tier}
        </a>

        {/* User profile / login */}
        {isAuthenticated && user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-800"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600/20">
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="h-7 w-7 rounded-full" />
                ) : (
                  <span className="text-[11px] font-bold text-brand-400">
                    {user.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="max-w-[120px] truncate text-xs font-medium text-surface-300">
                {user.displayName}
              </span>
              <ChevronDown className="h-3 w-3 text-surface-500" />
            </button>

            {/* Dropdown menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-surface-700 bg-surface-900 py-2 shadow-xl z-50">
                <div className="border-b border-surface-800 px-4 py-2">
                  <p className="text-sm font-medium text-white">{user.displayName}</p>
                  <p className="text-[11px] text-surface-400">{user.email}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <TierIcon className="h-3 w-3 text-brand-400" />
                    <span className="text-[10px] font-medium text-brand-400">
                      {tier.charAt(0).toUpperCase() + tier.slice(1)} Plan
                    </span>
                  </div>
                </div>
                <a
                  href="#/settings"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-surface-300 transition-colors hover:bg-surface-800"
                  onClick={() => setShowUserMenu(false)}
                >
                  <CreditCard className="h-4 w-4 text-surface-500" />
                  Manage Subscription
                </a>
                <button
                  onClick={() => {
                    logout()
                    setShowUserMenu(false)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 transition-colors hover:bg-surface-800"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <a
            href="#/auth"
            className="flex items-center gap-2 rounded-lg bg-brand-600/10 px-3 py-1.5 text-xs font-medium text-brand-400 transition-colors hover:bg-brand-600/20"
          >
            <User className="h-3.5 w-3.5" />
            Sign In
          </a>
        )}

        {/* Window controls (hidden on macOS — native traffic lights) */}
        {!isMac && (
          <div className="flex items-center gap-1">
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
      </div>
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
