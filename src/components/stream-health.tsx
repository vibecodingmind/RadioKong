"use client";

import { useAudioStore } from "@/lib/audio-store";

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function StreamHealth() {
  const { streamHealth, isLive } = useAudioStore();

  const bufferStatus = streamHealth.bufferLevel > 70 ? "OK" : streamHealth.bufferLevel > 40 ? "Low" : "Critical";
  const bufferColor = streamHealth.bufferLevel > 70 ? "text-rk-green" : streamHealth.bufferLevel > 40 ? "text-rk-yellow" : "text-rk-red";

  return (
    <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${
            streamHealth.connected ? "bg-rk-green" : "bg-rk-red"
          } ${streamHealth.connected && isLive ? "animate-pulse" : ""}`}
        />
        <span className={streamHealth.connected ? "text-rk-green" : "text-rk-red"}>
          {streamHealth.connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-3 bg-border" />

      {/* Uptime */}
      <div className="flex items-center gap-1">
        <span>Uptime:</span>
        <span className="text-foreground">
          {streamHealth.connected ? formatUptime(streamHealth.uptime) : "—"}
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-3 bg-border" />

      {/* Bitrate */}
      <div className="flex items-center gap-1">
        <span>Bitrate:</span>
        <span className="text-foreground">
          {streamHealth.connected ? `${streamHealth.currentBitrate} kbps` : "—"}
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-3 bg-border" />

      {/* Buffer */}
      <div className="flex items-center gap-1">
        <span>Buffer:</span>
        <span className={streamHealth.connected ? bufferColor : ""}>
          {streamHealth.connected ? `${bufferStatus} (${streamHealth.bufferLevel.toFixed(0)}%)` : "—"}
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-3 bg-border" />

      {/* Dropped frames */}
      <div className="flex items-center gap-1">
        <span>Dropped:</span>
        <span className={streamHealth.droppedFrames > 0 ? "text-rk-yellow" : "text-foreground"}>
          {streamHealth.connected ? streamHealth.droppedFrames : "—"}
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-3 bg-border" />

      {/* Bandwidth */}
      <div className="flex items-center gap-1">
        <span>BW:</span>
        <span className="text-foreground">
          {streamHealth.connected ? `${streamHealth.bandwidthUsage} kbps` : "—"}
        </span>
      </div>

      {/* Time display */}
      <div className="ml-auto text-foreground text-xs">
        {formatTime(streamHealth.uptime)}
      </div>
    </div>
  );
}
