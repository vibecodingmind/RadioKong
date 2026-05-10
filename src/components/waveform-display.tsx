"use client";

import { useEffect, useRef } from "react";
import { useAudioStore } from "@/lib/audio-store";

interface WaveformDisplayProps {
  analyserRef: React.RefObject<AnalyserNode | null>;
}

export function WaveformDisplay({ analyserRef }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const isLive = useAudioStore((s) => s.isLive);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Clear
      ctx.fillStyle = "#0a0a14";
      ctx.fillRect(0, 0, w, h);

      // Draw grid lines
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 1;

      // Vertical grid lines
      for (let i = 0; i < w; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
        ctx.stroke();
      }

      // Horizontal grid lines
      for (let i = 0; i < h; i += 20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
      }

      // Center line
      ctx.strokeStyle = "#2a2a3e";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      const analyser = analyserRef.current;
      if (analyser && isLive) {
        // Get waveform data
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        // Draw waveform with glow effect
        // Glow layer
        ctx.strokeStyle = "rgba(124, 58, 237, 0.3)";
        ctx.lineWidth = 6;
        ctx.beginPath();

        const sliceWidth = w / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * h) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.stroke();

        // Main waveform line
        ctx.strokeStyle = "#7c3aed";
        ctx.lineWidth = 2;
        ctx.beginPath();

        x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * h) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.stroke();
      } else {
        // Idle state - draw flat line
        ctx.strokeStyle = "#7c3aed40";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        // "NO SIGNAL" text
        ctx.fillStyle = "#64748b";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText("NO SIGNAL", w / 2, h / 2 - 8);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [analyserRef, isLive]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={160}
      className="w-full rounded-lg border border-border"
      style={{ height: 160 }}
    />
  );
}
