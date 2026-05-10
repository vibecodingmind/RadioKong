"use client";

import { useAudioStore, type MixerChannel as MixerChannelType } from "@/lib/audio-store";
import { Slider } from "@/components/ui/slider";

interface MixerChannelProps {
  channel: MixerChannelType;
}

function volumeToDb(volume: number): string {
  if (volume === 0) return "-∞";
  const db = 20 * Math.log10(volume);
  return `${db.toFixed(1)}`;
}

function PanKnob({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const rotation = (value * 135); // -135 to 135 degrees

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="relative w-7 h-7 rounded-full border border-border bg-secondary cursor-pointer"
        onClick={() => onChange(value === 0 ? 0.5 : value > 0 ? -0.5 : 0)}
      >
        {/* Indicator line */}
        <div
          className="absolute top-1/2 left-1/2 w-0.5 h-2.5 bg-rk-purple origin-bottom"
          style={{
            transform: `translate(-50%, -100%) rotate(${rotation}deg)`,
          }}
        />
        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-muted-foreground rounded-full -translate-x-1/2 -translate-y-1/2" />
      </div>
      <span className="text-[9px] text-muted-foreground font-mono">
        {value === 0 ? "C" : value < 0 ? `L${Math.abs(Math.round(value * 100 / 50))}` : `R${Math.round(value * 100 / 50)}`}
      </span>
    </div>
  );
}

export function MixerChannel({ channel }: MixerChannelProps) {
  const { setChannelVolume, setChannelPan, setChannelMute, setChannelSolo, setChannelDuck } = useAudioStore();

  // Slider value: 0-100 maps to 0-1
  const sliderValue = Math.round(channel.volume * 100);

  return (
    <div className="flex flex-col items-center gap-1.5 p-2 bg-card border border-border rounded-lg w-[72px]">
      {/* Channel name */}
      <span className="text-[10px] font-semibold text-rk-purple uppercase tracking-wider truncate w-full text-center">
        {channel.name}
      </span>

      {/* dB display */}
      <span className="text-[10px] font-mono text-muted-foreground">
        {volumeToDb(channel.volume)} dB
      </span>

      {/* Vertical Fader */}
      <div className="h-[140px] flex items-center">
        <Slider
          orientation="vertical"
          min={0}
          max={100}
          step={1}
          value={[sliderValue]}
          onValueChange={([v]) => setChannelVolume(channel.id, v / 100)}
          className="h-[130px]"
        />
      </div>

      {/* Pan knob */}
      <PanKnob value={channel.pan} onChange={(v) => setChannelPan(channel.id, v)} />

      {/* Buttons row */}
      <div className="flex gap-0.5">
        <button
          onClick={() => setChannelMute(channel.id, !channel.mute)}
          className={`w-5 h-5 rounded text-[9px] font-bold transition-colors ${
            channel.mute
              ? "bg-rk-red text-white"
              : "bg-secondary text-muted-foreground hover:bg-rk-red/20 hover:text-rk-red"
          }`}
          title="Mute"
        >
          M
        </button>
        <button
          onClick={() => setChannelSolo(channel.id, !channel.solo)}
          className={`w-5 h-5 rounded text-[9px] font-bold transition-colors ${
            channel.solo
              ? "bg-rk-yellow text-black"
              : "bg-secondary text-muted-foreground hover:bg-rk-yellow/20 hover:text-rk-yellow"
          }`}
          title="Solo"
        >
          S
        </button>
        <button
          onClick={() => setChannelDuck(channel.id, !channel.duck)}
          className={`w-5 h-5 rounded text-[9px] font-bold transition-colors ${
            channel.duck
              ? "bg-blue-500 text-white"
              : "bg-secondary text-muted-foreground hover:bg-blue-500/20 hover:text-blue-500"
          }`}
          title="Duck"
        >
          D
        </button>
      </div>
    </div>
  );
}
