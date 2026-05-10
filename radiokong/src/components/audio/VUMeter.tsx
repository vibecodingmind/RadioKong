interface VUMeterProps {
  level: number // 0.0 - 1.0
  peak: number // 0.0 - 1.0
  orientation?: 'vertical' | 'horizontal'
  height?: number
  showLabel?: boolean
  label?: string
}

export function VUMeter({
  level,
  peak,
  orientation = 'vertical',
  height = 160,
  showLabel = false,
  label,
}: VUMeterProps) {
  const clampedLevel = Math.min(Math.max(level, 0), 1)
  const clampedPeak = Math.min(Math.max(peak, 0), 1)

  const getBarColor = (value: number) => {
    if (value > 0.9) return 'bg-red-500'
    if (value > 0.7) return 'bg-yellow-500'
    return 'bg-emerald-500'
  }

  const getPeakColor = (value: number) => {
    if (value > 0.9) return 'bg-red-400'
    if (value > 0.7) return 'bg-yellow-400'
    return 'bg-emerald-400'
  }

  if (orientation === 'horizontal') {
    return (
      <div className="flex items-center gap-2">
        {showLabel && label && (
          <span className="w-10 text-right text-[10px] text-surface-400">{label}</span>
        )}
        <div className="relative h-3 w-full rounded-full bg-surface-800 overflow-hidden">
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-75 ${getBarColor(clampedLevel)}`}
            style={{ width: `${clampedLevel * 100}%` }}
          />
          <div
            className={`absolute top-0 h-full w-0.5 ${getPeakColor(clampedPeak)}`}
            style={{ left: `${clampedPeak * 100}%` }}
          />
        </div>
        <span className="w-10 text-[10px] text-surface-500">
          {Math.round(clampedLevel * 100)}%
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {showLabel && label && (
        <span className="text-[10px] text-surface-400">{label}</span>
      )}
      <div
        className="relative w-4 rounded-full bg-surface-800 overflow-hidden"
        style={{ height }}
      >
        {/* Segment markers */}
        {[0.9, 0.7, 0.5, 0.3, 0.1].map((mark) => (
          <div
            key={mark}
            className="absolute left-0 right-0 h-px bg-surface-700"
            style={{ bottom: `${mark * 100}%` }}
          />
        ))}
        {/* Level bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 rounded-full transition-all duration-75 ${getBarColor(clampedLevel)}`}
          style={{ height: `${clampedLevel * 100}%` }}
        />
        {/* Peak indicator */}
        <div
          className={`absolute left-0 right-0 h-1 ${getPeakColor(clampedPeak)}`}
          style={{ bottom: `${clampedPeak * 100}%` }}
        />
      </div>
    </div>
  )
}

interface StereoVUMeterProps {
  leftLevel: number
  rightLevel: number
  leftPeak?: number
  rightPeak?: number
  height?: number
  label?: string
}

export function StereoVUMeter({
  leftLevel,
  rightLevel,
  leftPeak = leftLevel,
  rightPeak = rightLevel,
  height = 160,
  label,
}: StereoVUMeterProps) {
  return (
    <div className="flex items-end gap-1">
      <VUMeter level={leftLevel} peak={leftPeak} height={height} label="L" showLabel />
      <VUMeter level={rightLevel} peak={rightPeak} height={height} label="R" showLabel />
      {label && (
        <span className="mt-2 text-[10px] text-surface-400">{label}</span>
      )}
    </div>
  )
}
