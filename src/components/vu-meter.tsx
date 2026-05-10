"use client";

import { useEffect, useRef } from "react";

interface VuMeterProps {
  level: number; // 0-1
  peak: number; // 0-1
  label?: string;
  orientation?: "vertical" | "horizontal";
  height?: number;
}

export function VuMeter({ level, peak, label, orientation = "vertical", height = 200 }: VuMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const displayLevelRef = useRef(0);
  const displayPeakRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      // Smooth level transitions
      displayLevelRef.current += (level - displayLevelRef.current) * 0.3;
      displayPeakRef.current += (peak - displayPeakRef.current) * 0.1;

      const dl = displayLevelRef.current;
      const dp = displayPeakRef.current;

      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      if (orientation === "vertical") {
        const barWidth = w - 4;
        const barHeight = h - 4;
        const x = 2;
        const y = 2;

        // Background
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(x, y, barWidth, barHeight);

        // Segments
        const segmentCount = 30;
        const segmentGap = 2;
        const segmentHeight = (barHeight - segmentGap * (segmentCount - 1)) / segmentCount;
        const activeSegments = Math.floor(dl * segmentCount);

        for (let i = 0; i < segmentCount; i++) {
          const segY = y + barHeight - (i + 1) * (segmentHeight + segmentGap) + segmentGap;

          if (i < activeSegments) {
            if (i >= segmentCount * 0.8) {
              ctx.fillStyle = "#ef4444"; // Red zone
            } else if (i >= segmentCount * 0.6) {
              ctx.fillStyle = "#eab308"; // Yellow zone
            } else {
              ctx.fillStyle = "#22c55e"; // Green zone
            }
          } else {
            ctx.fillStyle = "#0a0a14"; // Off
          }

          ctx.fillRect(x + 1, segY, barWidth - 2, segmentHeight);
        }

        // Peak indicator
        const peakY = y + barHeight - dp * barHeight;
        ctx.fillStyle = dp > 0.8 ? "#ef4444" : dp > 0.6 ? "#eab308" : "#22c55e";
        ctx.fillRect(x + 1, peakY - 1, barWidth - 2, 2);
      } else {
        // Horizontal meter
        const barWidth = w - 4;
        const barHeight = h - 4;
        const x = 2;
        const y = 2;

        // Background
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(x, y, barWidth, barHeight);

        // Segments
        const segmentCount = 40;
        const segmentGap = 1;
        const segmentWidth = (barWidth - segmentGap * (segmentCount - 1)) / segmentCount;
        const activeSegments = Math.floor(dl * segmentCount);

        for (let i = 0; i < segmentCount; i++) {
          const segX = x + i * (segmentWidth + segmentGap);

          if (i < activeSegments) {
            if (i >= segmentCount * 0.8) {
              ctx.fillStyle = "#ef4444";
            } else if (i >= segmentCount * 0.6) {
              ctx.fillStyle = "#eab308";
            } else {
              ctx.fillStyle = "#22c55e";
            }
          } else {
            ctx.fillStyle = "#0a0a14";
          }

          ctx.fillRect(segX, y + 1, segmentWidth, barHeight - 2);
        }

        // Peak indicator
        const peakX = x + dp * barWidth;
        ctx.fillStyle = dp > 0.8 ? "#ef4444" : dp > 0.6 ? "#eab308" : "#22c55e";
        ctx.fillRect(peakX - 1, y + 1, 2, barHeight - 2);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [level, peak, orientation]);

  const canvasWidth = orientation === "vertical" ? 28 : height;
  const canvasHeight = orientation === "vertical" ? height : 28;

  return (
    <div className="flex flex-col items-center gap-1">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="rounded-sm"
        style={{ width: canvasWidth, height: canvasHeight }}
      />
      {label && (
        <span className="text-[10px] text-muted-foreground font-mono">{label}</span>
      )}
    </div>
  );
}
