import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Radio,
  SlidersHorizontal,
  CircleDot,
  Settings,
  Mic,
} from 'lucide-react'
import { useAppStore } from '../../store'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/stream', icon: Radio, label: 'Live Stream' },
  { to: '/mixer', icon: SlidersHorizontal, label: 'Mixer' },
  { to: '/recordings', icon: CircleDot, label: 'Recordings' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const isStreaming = useAppStore((s) => s.isStreaming)

  return (
    <aside className="flex w-60 flex-col border-r border-surface-800 bg-surface-950">
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 border-b border-surface-800 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
          <Mic className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white">RadioKong</h1>
          <p className="text-[10px] font-medium uppercase tracking-wider text-surface-400">
            Pro Streamer
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-brand-600/15 text-brand-400'
                      : 'text-surface-400 hover:bg-surface-800/60 hover:text-surface-200'
                  }`
                }
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Stream Status */}
      <div className="border-t border-surface-800 p-4">
        <div className="rounded-lg bg-surface-900/80 p-3">
          <div className="mb-2 flex items-center gap-2">
            <div
              className={
                isStreaming ? 'status-live' : 'status-offline'
              }
            />
            <span className="text-xs font-medium text-surface-300">
              {isStreaming ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <p className="text-[11px] text-surface-500">
            {isStreaming
              ? 'Stream is active'
              : 'Ready to stream'}
          </p>
        </div>
      </div>
    </aside>
  )
}
