"use client";

import { useAudioStore } from "@/lib/audio-store";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function MiniSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground">{label}</Label>
        <span className="text-[10px] font-mono text-foreground">
          {value.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="h-3"
      />
    </div>
  );
}

export function DspPanel() {
  const { dsp, setEqBand, setCompressor, setLimiter, setGate, setDsp, applyPreset } = useAudioStore();

  const eqLabels = ["Low", "Mid", "High"];
  const eqFrequencies = ["200 Hz", "1 kHz", "4 kHz"];

  return (
    <div className="flex flex-col gap-3 text-xs max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
      {/* Preset selector */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Preset</Label>
        <Select value={dsp.preset} onValueChange={applyPreset}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="flat">Flat</SelectItem>
            <SelectItem value="radio-warm">Radio Warm</SelectItem>
            <SelectItem value="voice-clarity">Voice Clarity</SelectItem>
            <SelectItem value="bass-boost">Bass Boost</SelectItem>
            <SelectItem value="bright">Bright</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* EQ Section */}
      <div className="bg-secondary/30 rounded-md p-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-rk-purple uppercase tracking-wider">Equalizer</span>
          <Switch
            checked={!dsp.eqBypass}
            onCheckedChange={(checked) => setDsp({ eqBypass: !checked })}
            className="scale-75"
          />
        </div>
        {dsp.eq.map((band, i) => (
          <div key={i} className="space-y-0.5">
            <MiniSlider
              label={`${eqLabels[i]} (${eqFrequencies[i]})`}
              value={band.gain}
              min={-12}
              max={12}
              step={0.5}
              unit=" dB"
              onChange={(v) => setEqBand(i, { gain: v })}
            />
          </div>
        ))}
      </div>

      {/* Compressor Section */}
      <div className="bg-secondary/30 rounded-md p-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-rk-purple uppercase tracking-wider">Compressor</span>
          <Switch
            checked={!dsp.compressor.bypass}
            onCheckedChange={(checked) => setCompressor({ bypass: !checked })}
            className="scale-75"
          />
        </div>
        <MiniSlider
          label="Threshold"
          value={dsp.compressor.threshold}
          min={-60}
          max={0}
          step={1}
          unit=" dB"
          onChange={(v) => setCompressor({ threshold: v })}
        />
        <MiniSlider
          label="Ratio"
          value={dsp.compressor.ratio}
          min={1}
          max={20}
          step={0.5}
          unit=":1"
          onChange={(v) => setCompressor({ ratio: v })}
        />
        <MiniSlider
          label="Attack"
          value={dsp.compressor.attack}
          min={0}
          max={500}
          step={1}
          unit=" ms"
          onChange={(v) => setCompressor({ attack: v })}
        />
        <MiniSlider
          label="Release"
          value={dsp.compressor.release}
          min={10}
          max={5000}
          step={10}
          unit=" ms"
          onChange={(v) => setCompressor({ release: v })}
        />
        <MiniSlider
          label="Makeup Gain"
          value={dsp.compressor.makeupGain}
          min={0}
          max={24}
          step={0.5}
          unit=" dB"
          onChange={(v) => setCompressor({ makeupGain: v })}
        />
      </div>

      {/* Limiter Section */}
      <div className="bg-secondary/30 rounded-md p-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-rk-purple uppercase tracking-wider">Limiter</span>
          <Switch
            checked={!dsp.limiter.bypass}
            onCheckedChange={(checked) => setLimiter({ bypass: !checked })}
            className="scale-75"
          />
        </div>
        <MiniSlider
          label="Ceiling"
          value={dsp.limiter.ceiling}
          min={-6}
          max={0}
          step={0.1}
          unit=" dB"
          onChange={(v) => setLimiter({ ceiling: v })}
        />
        <MiniSlider
          label="Release"
          value={dsp.limiter.release}
          min={10}
          max={5000}
          step={10}
          unit=" ms"
          onChange={(v) => setLimiter({ release: v })}
        />
      </div>

      {/* Noise Gate Section */}
      <div className="bg-secondary/30 rounded-md p-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-rk-purple uppercase tracking-wider">Noise Gate</span>
          <Switch
            checked={!dsp.gate.bypass}
            onCheckedChange={(checked) => setGate({ bypass: !checked })}
            className="scale-75"
          />
        </div>
        <MiniSlider
          label="Threshold"
          value={dsp.gate.threshold}
          min={-80}
          max={0}
          step={1}
          unit=" dB"
          onChange={(v) => setGate({ threshold: v })}
        />
        <MiniSlider
          label="Release"
          value={dsp.gate.release}
          min={10}
          max={5000}
          step={10}
          unit=" ms"
          onChange={(v) => setGate({ release: v })}
        />
      </div>
    </div>
  );
}
