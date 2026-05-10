import { useRef, useEffect } from 'react'

interface WaveformDisplayProps {
  data: Float32Array | null
  width?: number
  height?: number
  color?: string
  backgroundColor?: string
}

export function WaveformDisplay({
  data,
  width = 600,
  height = 80,
  color = '#e84849',
  backgroundColor = 'transparent',
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Clear
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)

    if (!data || data.length === 0) {
      // Draw center line when no data
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()
      return
    }

    const sliceWidth = width / data.length
    const midY = height / 2

    // Draw waveform
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.beginPath()

    for (let i = 0; i < data.length; i++) {
      const x = i * sliceWidth
      const y = midY + data[i] * midY

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.stroke()

    // Fill below waveform
    ctx.lineTo(width, midY)
    ctx.lineTo(0, midY)
    ctx.closePath()

    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, `${color}40`)
    gradient.addColorStop(0.5, `${color}10`)
    gradient.addColorStop(1, `${color}40`)
    ctx.fillStyle = gradient
    ctx.fill()
  }, [data, width, height, color, backgroundColor])

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="waveform-canvas rounded-lg"
    />
  )
}
