import { useCallback, useRef, useState } from 'react'

interface RotaryKnobProps {
  value: number
  min: number
  max: number
  step?: number
  size?: number
  label?: string
  unit?: string
  color?: string
  onChange: (value: number) => void
}

/**
 * A polished rotary knob component for audio controls.
 * Supports both click-drag interaction and scroll wheel.
 * Rendered using CSS transforms for smooth rotation.
 */
export function RotaryKnob({
  value,
  min,
  max,
  step = 1,
  size = 48,
  label,
  unit = '',
  color = '#3b82f6',
  onChange,
}: RotaryKnobProps) {
  const knobRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragStartValue = useRef(0)

  // Calculate rotation angle: -135deg (min) to +135deg (max), total 270deg travel
  const normalizedValue = (value - min) / (max - min)
  const rotation = -135 + normalizedValue * 270

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      dragStartY.current = e.clientY
      dragStartValue.current = value

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = dragStartY.current - moveEvent.clientY
        const sensitivity = (max - min) / 150 // 150px drag = full range
        let newValue = dragStartValue.current + deltaY * sensitivity

        // Apply step
        if (step > 0) {
          newValue = Math.round(newValue / step) * step
        }

        newValue = Math.max(min, Math.min(max, newValue))
        onChange(newValue)
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [value, min, max, step, onChange]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const direction = e.deltaY > 0 ? -1 : 1
      let newValue = value + direction * step * 3
      if (step > 0) {
        newValue = Math.round(newValue / step) * step
      }
      newValue = Math.max(min, Math.min(max, newValue))
      onChange(newValue)
    },
    [value, min, max, step, onChange]
  )

  const handleDoubleClick = useCallback(() => {
    // Reset to center/default
    const defaultValue = (min + max) / 2
    onChange(defaultValue)
  }, [min, max, onChange])

  const displayValue = step < 1 ? value.toFixed(1) : Math.round(value)

  return (
    <div className="flex flex-col items-center gap-1.5">
      {label && (
        <span className="text-[9px] font-medium uppercase tracking-wider text-surface-500">
          {label}
        </span>
      )}

      <div
        ref={knobRef}
        className={`relative cursor-grab select-none ${isDragging ? 'cursor-grabbing' : ''}`}
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        {/* Outer ring (track) */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(
              from 225deg,
              ${color}44 0%,
              ${color} ${normalizedValue * 75}%,
              #1e293b ${normalizedValue * 75}%,
              #1e293b 75%,
              transparent 75%
            )`,
            padding: 3,
          }}
        >
          <div className="h-full w-full rounded-full bg-surface-900" />
        </div>

        {/* Knob body */}
        <div
          className="absolute rounded-full border-2 transition-shadow"
          style={{
            inset: 4,
            background: `radial-gradient(circle at 40% 35%, #334155, #1e293b)`,
            borderColor: isDragging ? color : '#475569',
            boxShadow: isDragging
              ? `0 0 12px ${color}44, inset 0 1px 2px rgba(255,255,255,0.1)`
              : 'inset 0 1px 2px rgba(255,255,255,0.05)',
            transform: `rotate(${rotation}deg)`,
          }}
        >
          {/* Indicator line */}
          <div
            className="absolute left-1/2 top-1 h-3 w-0.5 -translate-x-1/2 rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>

        {/* Center cap */}
        <div
          className="absolute rounded-full"
          style={{
            inset: size * 0.35,
            background: 'radial-gradient(circle, #0f172a, #1e293b)',
          }}
        />
      </div>

      <span className="text-[10px] font-mono text-surface-400">
        {displayValue}{unit}
      </span>
    </div>
  )
}

/**
 * A vertical fader component with professional styling.
 */
interface VerticalFaderProps {
  value: number
  min?: number
  max?: number
  step?: number
  height?: number
  color?: string
  label?: string
  onChange: (value: number) => void
}

export function VerticalFader({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  height = 140,
  color = '#3b82f6',
  label,
  onChange,
}: VerticalFaderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const normalizedValue = (value - min) / (max - min)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!trackRef.current) return
        const rect = trackRef.current.getBoundingClientRect()
        const y = moveEvent.clientY - rect.top
        const ratio = 1 - (y / rect.height)
        let newValue = min + ratio * (max - min)
        if (step > 0) {
          newValue = Math.round(newValue / step) * step
        }
        newValue = Math.max(min, Math.min(max, newValue))
        onChange(newValue)
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
        const ratio = 1 - (y / rect.height)
        let newValue = min + ratio * (max - min)
        if (step > 0) {
          newValue = Math.round(newValue / step) * step
        }
        newValue = Math.max(min, Math.min(max, newValue))
        onChange(newValue)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [min, max, step, onChange]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const direction = e.deltaY > 0 ? -1 : 1
      let newValue = value + direction * step * 5
      if (step > 0) {
        newValue = Math.round(newValue / step) * step
      }
      newValue = Math.max(min, Math.min(max, newValue))
      onChange(newValue)
    },
    [value, min, max, step, onChange]
  )

  const percent = Math.round(normalizedValue * 100)
  const thumbY = (1 - normalizedValue) * height

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <span className="text-[9px] font-medium uppercase tracking-wider text-surface-500">
          {label}
        </span>
      )}

      {/* Fader track */}
      <div
        ref={trackRef}
        className={`relative w-8 cursor-pointer rounded-full ${isDragging ? '' : ''}`}
        style={{ height }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        {/* Track background */}
        <div className="absolute inset-x-1.5 inset-y-0 rounded-full bg-surface-800" />

        {/* Filled portion */}
        <div
          className="absolute inset-x-1.5 bottom-0 rounded-full transition-all"
          style={{
            height: `${normalizedValue * 100}%`,
            background: `linear-gradient(to top, ${color}, ${color}88)`,
          }}
        />

        {/* Scale marks */}
        {[0, 0.25, 0.5, 0.75, 1].map((mark) => (
          <div
            key={mark}
            className="absolute right-0 h-px w-1.5 bg-surface-600"
            style={{ bottom: `${mark * 100}%` }}
          />
        ))}

        {/* Thumb */}
        <div
          className="absolute inset-x-0 h-4 cursor-grab rounded-md border transition-shadow"
          style={{
            top: thumbY - 8,
            background: `linear-gradient(to bottom, #475569, #334155)`,
            borderColor: isDragging ? color : '#64748b',
            boxShadow: isDragging
              ? `0 0 8px ${color}44`
              : '0 1px 3px rgba(0,0,0,0.3)',
          }}
        >
          {/* Grip lines */}
          <div className="flex flex-col items-center justify-center gap-0.5 py-1">
            <div className="h-px w-3 bg-surface-500" />
            <div className="h-px w-3 bg-surface-500" />
            <div className="h-px w-3 bg-surface-500" />
          </div>
        </div>
      </div>

      <span className="text-[10px] font-mono text-surface-400">
        {percent}%
      </span>
    </div>
  )
}
