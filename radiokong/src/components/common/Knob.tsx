import { useCallback, useRef, useState } from 'react'

interface KnobProps {
  value: number          // 0.0 - 1.0
  onChange: (value: number) => void
  size?: number          // diameter in px
  min?: number
  max?: number
  step?: number
  label?: string
  unit?: string
  color?: string
  disabled?: boolean
}

/**
 * Professional rotary knob component for audio control.
 * Supports mouse drag (vertical) to adjust value, 
 * double-click to reset to default, and scroll wheel.
 */
export function Knob({
  value,
  onChange,
  size = 48,
  min = 0,
  max = 1,
  step = 0.01,
  label,
  unit = '',
  color = '#e84849',
  disabled = false,
}: KnobProps) {
  const knobRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const startY = useRef(0)
  const startValue = useRef(0)

  const normalizedValue = (value - min) / (max - min)
  const angle = -135 + normalizedValue * 270 // -135° to +135°

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      e.preventDefault()
      setIsDragging(true)
      startY.current = e.clientY
      startValue.current = value

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = startY.current - moveEvent.clientY
        const sensitivity = (max - min) / 120 // Full range over 120px
        const newValue = Math.min(max, Math.max(min, startValue.current + deltaY * sensitivity))
        
        // Snap to step
        const snapped = Math.round(newValue / step) * step
        onChange(parseFloat(snapped.toFixed(4)))
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [value, min, max, step, onChange, disabled]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (disabled) return
      e.preventDefault()
      const direction = e.deltaY > 0 ? -1 : 1
      const newValue = Math.min(max, Math.max(min, value + direction * step))
      const snapped = Math.round(newValue / step) * step
      onChange(parseFloat(snapped.toFixed(4)))
    },
    [value, min, max, step, onChange, disabled]
  )

  const handleDoubleClick = useCallback(() => {
    if (disabled) return
    const defaultValue = (max - min) / 2 + min
    onChange(defaultValue)
  }, [min, max, onChange, disabled])

  const displayValue = formatDisplayValue(value, step, unit)

  return (
    <div className="flex flex-col items-center gap-1.5">
      {label && (
        <span className="text-[10px] font-medium uppercase tracking-wider text-surface-500">
          {label}
        </span>
      )}

      <div
        ref={knobRef}
        className={`relative select-none ${disabled ? 'opacity-40' : 'cursor-grab'} ${isDragging ? 'cursor-grabbing' : ''}`}
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        {/* Outer ring / track */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          className="absolute inset-0"
        >
          {/* Background arc */}
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="#1e293b"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${Math.PI * 40 * 0.75} ${Math.PI * 40}`}
            transform="rotate(135 24 24)"
          />
          {/* Value arc */}
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${Math.PI * 40 * 0.75 * normalizedValue} ${Math.PI * 40}`}
            transform="rotate(135 24 24)"
            style={{ transition: isDragging ? 'none' : 'stroke-dasharray 0.1s' }}
          />
        </svg>

        {/* Knob body */}
        <div
          className="absolute inset-[6px] rounded-full shadow-lg"
          style={{
            background: 'linear-gradient(145deg, #334155, #1e293b)',
            transform: `rotate(${angle}deg)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {/* Pointer line */}
          <div
            className="absolute left-1/2 top-1 h-[40%] w-[2px] -translate-x-1/2 rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>

        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: isDragging ? color : '#475569' }}
          />
        </div>
      </div>

      <span className="text-[10px] font-mono text-surface-400">
        {displayValue}
      </span>
    </div>
  )
}

interface VerticalFaderProps {
  value: number
  onChange: (value: number) => void
  height?: number
  label?: string
  color?: string
  disabled?: boolean
}

/**
 * Professional vertical fader component for mixer channels.
 * Supports mouse drag and scroll wheel.
 */
export function VerticalFader({
  value,
  onChange,
  height = 140,
  label,
  color = '#e84849',
  disabled = false,
}: VerticalFaderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      e.preventDefault()
      setIsDragging(true)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!trackRef.current) return
        const rect = trackRef.current.getBoundingClientRect()
        const y = moveEvent.clientY - rect.top
        const pct = 1 - Math.min(Math.max(y / rect.height, 0), 1)
        onChange(parseFloat(pct.toFixed(3)))
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      // Set value immediately on click
      if (trackRef.current) {
        const rect = trackRef.current.getBoundingClientRect()
        const y = e.clientY - rect.top
        const pct = 1 - Math.min(Math.max(y / rect.height, 0), 1)
        onChange(parseFloat(pct.toFixed(3)))
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [onChange, disabled]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (disabled) return
      e.preventDefault()
      const direction = e.deltaY > 0 ? -0.02 : 0.02
      onChange(parseFloat(Math.min(1, Math.max(0, value + direction)).toFixed(3)))
    },
    [value, onChange, disabled]
  )

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <span className="text-[10px] font-medium text-surface-400">{label}</span>
      )}

      <div
        ref={trackRef}
        className={`relative w-3 rounded-full bg-surface-800 ${disabled ? 'opacity-40' : 'cursor-pointer'}`}
        style={{ height }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        {/* Level fill */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full transition-[height] duration-75"
          style={{
            height: `${value * 100}%`,
            background: `linear-gradient(to top, ${color}40, ${color})`,
          }}
        />

        {/* Scale markings */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((mark) => (
          <div
            key={mark}
            className="absolute left-0 right-0 h-px bg-surface-600/50"
            style={{ bottom: `${mark * 100}%` }}
          />
        ))}

        {/* Thumb */}
        <div
          className="absolute left-1/2 -translate-x-1/2 h-5 w-5 rounded-md border-2 shadow-lg"
          style={{
            bottom: `calc(${value * 100}% - 10px)`,
            borderColor: color,
            backgroundColor: '#1e293b',
            transition: isDragging ? 'none' : 'bottom 0.075s ease-out',
          }}
        >
          {/* Grip lines */}
          <div className="flex h-full flex-col items-center justify-center gap-0.5">
            <div className="h-px w-2.5 bg-surface-500" />
            <div className="h-px w-2.5 bg-surface-500" />
            <div className="h-px w-2.5 bg-surface-500" />
          </div>
        </div>
      </div>

      <span className="text-[10px] font-mono text-surface-400">
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}

function formatDisplayValue(value: number, step: number, unit: string): string {
  if (step >= 1) return `${Math.round(value)}${unit}`
  if (step >= 0.1) return `${value.toFixed(1)}${unit}`
  if (step >= 0.01) return `${value.toFixed(2)}${unit}`
  return `${value.toFixed(1)}${unit}`
}
