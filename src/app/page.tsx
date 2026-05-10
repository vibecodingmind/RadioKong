"use client";

import { useEffect, useState } from "react";
import { useAudioStore } from "@/lib/audio-store";
import { useAudioEngine } from "@/lib/use-audio-engine";
import { VuMeter } from "@/components/vu-meter";
import { MixerChannel } from "@/components/mixer-channel";
import { WaveformDisplay } from "@/components/waveform-display";
import { StreamSettings } from "@/components/stream-settings";
import { DspPanel } from "@/components/dsp-panel";
import { MetadataPanel } from "@/components/metadata-panel";
import { StreamHealth } from "@/components/stream-health";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function formatClock(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-US", { hour12: false });
}

export default function Home() {
  const { isLive, isRecording, channels, leftLevel, rightLevel, leftPeak, rightPeak, setIsRecording, streamConnection } = useAudioStore();
  const { startAudioCapture, stopAudioCapture, analyser } = useAudioEngine();
  const [clock, setClock] = useState(formatClock());
  const [micError, setMicError] = useState<string | null>(null);

  // Clock
  useEffect(() => {
    const interval = setInterval(() => setClock(formatClock()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleGoLive = async () => {
    if (isLive) {
      stopAudioCapture();
      setMicError(null);
    } else {
      try {
        setMicError(null);
        await startAudioCapture();
      } catch {
        setMicError("Microphone access denied. Please allow mic access in your browser settings.");
      }
    }
  };

  const handleRecord = () => {
    if (!isLive) return;
    setIsRecording(!isRecording);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* ─── Top Bar ─── */}
      <header className="flex items-center h-12 px-4 border-b border-border bg-card shrink-0 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-rk-purple flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight">
            Radio<span className="text-rk-purple">Kong</span>
          </span>
        </div>

        {/* ON AIR indicator */}
        <div className="flex items-center gap-1.5 ml-4">
          {isLive && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rk-red/20 border border-rk-red/40">
              <div className="w-2 h-2 rounded-full bg-rk-red on-air-pulse" />
              <span className="text-[10px] font-bold text-rk-red uppercase tracking-wider">ON AIR</span>
            </div>
          )}
          {!isLive && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted border border-border">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">OFFLINE</span>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* GO LIVE button */}
        <button
          onClick={handleGoLive}
          className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
            isLive
              ? "bg-rk-red hover:bg-rk-red/90 text-white"
              : "bg-rk-green hover:bg-rk-green/90 text-white"
          }`}
        >
          {isLive ? "STOP" : "GO LIVE"}
        </button>

        {/* REC button */}
        <button
          onClick={handleRecord}
          disabled={!isLive}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
            isRecording
              ? "bg-rk-red text-white"
              : isLive
                ? "bg-secondary text-muted-foreground hover:bg-rk-red/20 hover:text-rk-red"
                : "bg-secondary text-muted-foreground/40 cursor-not-allowed"
          }`}
        >
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isRecording ? "bg-white on-air-pulse" : isLive ? "bg-rk-red" : "bg-muted-foreground/40"
            }`}
          />
          REC
        </button>

        {/* Clock */}
        <span className="text-xs font-mono text-muted-foreground ml-2">{clock}</span>
      </header>

      {/* Mic error banner */}
      {micError && (
        <div className="px-4 py-2 bg-rk-red/10 border-b border-rk-red/30 text-rk-red text-xs">
          {micError}
        </div>
      )}

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex min-h-0">
        {/* ─── Left Panel: Mixer Channels ─── */}
        <aside className="flex flex-col border-r border-border bg-card p-3 gap-3 shrink-0">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">
            Mixer
          </span>
          <div className="flex gap-2">
            {channels.map((channel) => (
              <MixerChannel key={channel.id} channel={channel} />
            ))}
          </div>

          {/* Master VU Meters */}
          <div className="flex items-end justify-center gap-3 mt-2 pt-3 border-t border-border">
            <VuMeter level={leftLevel} peak={leftPeak} label="L" height={160} />
            <VuMeter level={rightLevel} peak={rightPeak} label="R" height={160} />
          </div>
        </aside>

        {/* ─── Center Panel ─── */}
        <main className="flex-1 flex flex-col p-4 gap-4 min-w-0">
          {/* Waveform */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Waveform
            </span>
            <WaveformDisplay analyserRef={analyser} />
          </div>

          {/* Horizontal level meters */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Output Level
            </span>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground w-3">L</span>
                <div className="flex-1 h-4 rounded-sm overflow-hidden bg-secondary/50">
                  <div
                    className="h-full rounded-sm transition-all duration-75"
                    style={{
                      width: `${Math.min(leftLevel * 100, 100)}%`,
                      background: leftLevel > 0.8
                        ? "#ef4444"
                        : leftLevel > 0.6
                          ? "#eab308"
                          : "#22c55e",
                    }}
                  />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground w-12 text-right">
                  {(leftLevel * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground w-3">R</span>
                <div className="flex-1 h-4 rounded-sm overflow-hidden bg-secondary/50">
                  <div
                    className="h-full rounded-sm transition-all duration-75"
                    style={{
                      width: `${Math.min(rightLevel * 100, 100)}%`,
                      background: rightLevel > 0.8
                        ? "#ef4444"
                        : rightLevel > 0.6
                          ? "#eab308"
                          : "#22c55e",
                    }}
                  />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground w-12 text-right">
                  {(rightLevel * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Center info panel - stream health details */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="bg-card border border-border rounded-lg p-3 flex-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Stream Status
              </span>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Server</span>
                  <span className="font-mono">{streamConnection.serverType === "icecast" ? "Icecast" : "SHOUTcast"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Codec</span>
                  <span className="font-mono uppercase">{streamConnection.codec}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bitrate</span>
                  <span className="font-mono">{streamConnection.bitrate} kbps</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mount</span>
                  <span className="font-mono">{streamConnection.mount}</span>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ─── Right Panel: Tabs ─── */}
        <aside className="w-[280px] border-l border-border bg-card p-3 shrink-0 flex flex-col">
          <Tabs defaultValue="stream" className="flex-1 flex flex-col">
            <TabsList className="w-full h-8">
              <TabsTrigger value="stream" className="text-[10px] flex-1">Stream</TabsTrigger>
              <TabsTrigger value="dsp" className="text-[10px] flex-1">DSP</TabsTrigger>
              <TabsTrigger value="meta" className="text-[10px] flex-1">Meta</TabsTrigger>
            </TabsList>
            <TabsContent value="stream" className="flex-1 mt-2 overflow-y-auto custom-scrollbar">
              <StreamSettings />
            </TabsContent>
            <TabsContent value="dsp" className="flex-1 mt-2 overflow-y-auto custom-scrollbar">
              <DspPanel />
            </TabsContent>
            <TabsContent value="meta" className="flex-1 mt-2 overflow-y-auto custom-scrollbar">
              <MetadataPanel />
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      {/* ─── Bottom Bar: Stream Health ─── */}
      <footer className="h-8 flex items-center px-4 border-t border-border bg-card shrink-0">
        <StreamHealth />
      </footer>
    </div>
  );
}
