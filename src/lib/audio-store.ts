import { create } from "zustand";

export interface MixerChannel {
  id: string;
  name: string;
  volume: number; // 0-1
  pan: number; // -1 to 1
  mute: boolean;
  solo: boolean;
  duck: boolean;
}

export interface StreamConnection {
  serverType: "icecast" | "shoutcast";
  host: string;
  port: number;
  password: string;
  mount: string;
  codec: "mp3" | "ogg" | "aac" | "opus" | "flac";
  bitrate: 64 | 96 | 128 | 192 | 256 | 320;
  autoReconnect: boolean;
}

export interface EQBand {
  frequency: number;
  gain: number; // -12 to 12 dB
  q: number;
}

export interface CompressorSettings {
  threshold: number; // -60 to 0 dB
  ratio: number; // 1 to 20
  attack: number; // 0 to 500 ms
  release: number; // 10 to 5000 ms
  makeupGain: number; // 0 to 24 dB
  bypass: boolean;
}

export interface LimiterSettings {
  ceiling: number; // -6 to 0 dB
  release: number; // 10 to 5000 ms
  bypass: boolean;
}

export interface GateSettings {
  threshold: number; // -80 to 0 dB
  release: number; // 10 to 5000 ms
  bypass: boolean;
}

export interface DspSettings {
  eq: EQBand[];
  eqBypass: boolean;
  compressor: CompressorSettings;
  limiter: LimiterSettings;
  gate: GateSettings;
  preset: string;
}

export interface StreamHealth {
  connected: boolean;
  uptime: number; // seconds
  currentBitrate: number;
  bufferLevel: number; // 0-100
  droppedFrames: number;
  bandwidthUsage: number; // kbps
}

interface AudioState {
  // Live state
  isLive: boolean;
  isRecording: boolean;

  // Mixer
  channels: MixerChannel[];

  // Stream
  streamConnection: StreamConnection;

  // DSP
  dsp: DspSettings;

  // Metadata
  metadata: {
    title: string;
    artist: string;
    autoUpdate: boolean;
  };

  // Stream health
  streamHealth: StreamHealth;

  // VU meter levels
  leftLevel: number;
  rightLevel: number;
  leftPeak: number;
  rightPeak: number;

  // Actions
  setIsLive: (live: boolean) => void;
  setIsRecording: (recording: boolean) => void;
  setChannelVolume: (id: string, volume: number) => void;
  setChannelPan: (id: string, pan: number) => void;
  setChannelMute: (id: string, mute: boolean) => void;
  setChannelSolo: (id: string, solo: boolean) => void;
  setChannelDuck: (id: string, duck: boolean) => void;
  setStreamConnection: (conn: Partial<StreamConnection>) => void;
  setDsp: (dsp: Partial<DspSettings>) => void;
  setEqBand: (index: number, band: Partial<EQBand>) => void;
  setCompressor: (comp: Partial<CompressorSettings>) => void;
  setLimiter: (limiter: Partial<LimiterSettings>) => void;
  setGate: (gate: Partial<GateSettings>) => void;
  setMetadata: (meta: Partial<{ title: string; artist: string; autoUpdate: boolean }>) => void;
  setStreamHealth: (health: Partial<StreamHealth>) => void;
  setLevels: (left: number, right: number, leftPeak: number, rightPeak: number) => void;
  applyPreset: (preset: string) => void;
}

const defaultChannels: MixerChannel[] = [
  { id: "mic", name: "Mic", volume: 0.75, pan: 0, mute: false, solo: false, duck: false },
  { id: "line1", name: "Line 1", volume: 0.5, pan: 0, mute: false, solo: false, duck: false },
  { id: "line2", name: "Line 2", volume: 0.5, pan: 0, mute: true, solo: false, duck: false },
  { id: "line3", name: "Line 3", volume: 0.5, pan: 0, mute: true, solo: false, duck: false },
];

const defaultStreamConnection: StreamConnection = {
  serverType: "icecast",
  host: "localhost",
  port: 8000,
  password: "",
  mount: "/live",
  codec: "mp3",
  bitrate: 128,
  autoReconnect: true,
};

const defaultDsp: DspSettings = {
  eq: [
    { frequency: 200, gain: 0, q: 1.0 },
    { frequency: 1000, gain: 0, q: 1.0 },
    { frequency: 4000, gain: 0, q: 1.0 },
  ],
  eqBypass: false,
  compressor: {
    threshold: -24,
    ratio: 4,
    attack: 10,
    release: 100,
    makeupGain: 0,
    bypass: false,
  },
  limiter: {
    ceiling: -1,
    release: 50,
    bypass: false,
  },
  gate: {
    threshold: -60,
    release: 100,
    bypass: true,
  },
  preset: "flat",
};

const presets: Record<string, Partial<DspSettings>> = {
  flat: {
    eq: [
      { frequency: 200, gain: 0, q: 1.0 },
      { frequency: 1000, gain: 0, q: 1.0 },
      { frequency: 4000, gain: 0, q: 1.0 },
    ],
    eqBypass: false,
    compressor: { threshold: -24, ratio: 4, attack: 10, release: 100, makeupGain: 0, bypass: false },
    limiter: { ceiling: -1, release: 50, bypass: false },
    gate: { threshold: -60, release: 100, bypass: true },
  },
  "radio-warm": {
    eq: [
      { frequency: 200, gain: 3, q: 0.8 },
      { frequency: 1000, gain: -1, q: 1.0 },
      { frequency: 4000, gain: 2, q: 1.2 },
    ],
    eqBypass: false,
    compressor: { threshold: -20, ratio: 6, attack: 5, release: 80, makeupGain: 2, bypass: false },
    limiter: { ceiling: -1, release: 50, bypass: false },
    gate: { threshold: -50, release: 80, bypass: false },
  },
  "voice-clarity": {
    eq: [
      { frequency: 200, gain: -3, q: 1.0 },
      { frequency: 1000, gain: 2, q: 0.8 },
      { frequency: 4000, gain: 4, q: 1.0 },
    ],
    eqBypass: false,
    compressor: { threshold: -18, ratio: 5, attack: 5, release: 60, makeupGain: 3, bypass: false },
    limiter: { ceiling: -0.5, release: 30, bypass: false },
    gate: { threshold: -45, release: 60, bypass: false },
  },
  "bass-boost": {
    eq: [
      { frequency: 200, gain: 6, q: 0.7 },
      { frequency: 1000, gain: 0, q: 1.0 },
      { frequency: 4000, gain: 1, q: 1.0 },
    ],
    eqBypass: false,
    compressor: { threshold: -22, ratio: 4, attack: 15, release: 120, makeupGain: 1, bypass: false },
    limiter: { ceiling: -1, release: 50, bypass: false },
    gate: { threshold: -55, release: 100, bypass: true },
  },
  bright: {
    eq: [
      { frequency: 200, gain: -1, q: 1.0 },
      { frequency: 1000, gain: 1, q: 1.0 },
      { frequency: 4000, gain: 5, q: 1.2 },
    ],
    eqBypass: false,
    compressor: { threshold: -20, ratio: 5, attack: 8, release: 80, makeupGain: 2, bypass: false },
    limiter: { ceiling: -0.5, release: 40, bypass: false },
    gate: { threshold: -50, release: 80, bypass: true },
  },
};

export const useAudioStore = create<AudioState>((set) => ({
  isLive: false,
  isRecording: false,
  channels: defaultChannels,
  streamConnection: defaultStreamConnection,
  dsp: defaultDsp,
  metadata: { title: "", artist: "", autoUpdate: false },
  streamHealth: {
    connected: false,
    uptime: 0,
    currentBitrate: 0,
    bufferLevel: 0,
    droppedFrames: 0,
    bandwidthUsage: 0,
  },
  leftLevel: 0,
  rightLevel: 0,
  leftPeak: 0,
  rightPeak: 0,

  setIsLive: (live) => set({ isLive: live }),
  setIsRecording: (recording) => set({ isRecording: recording }),

  setChannelVolume: (id, volume) =>
    set((state) => ({
      channels: state.channels.map((ch) => (ch.id === id ? { ...ch, volume } : ch)),
    })),

  setChannelPan: (id, pan) =>
    set((state) => ({
      channels: state.channels.map((ch) => (ch.id === id ? { ...ch, pan } : ch)),
    })),

  setChannelMute: (id, mute) =>
    set((state) => ({
      channels: state.channels.map((ch) => (ch.id === id ? { ...ch, mute } : ch)),
    })),

  setChannelSolo: (id, solo) =>
    set((state) => ({
      channels: state.channels.map((ch) => (ch.id === id ? { ...ch, solo } : ch)),
    })),

  setChannelDuck: (id, duck) =>
    set((state) => ({
      channels: state.channels.map((ch) => (ch.id === id ? { ...ch, duck } : ch)),
    })),

  setStreamConnection: (conn) =>
    set((state) => ({
      streamConnection: { ...state.streamConnection, ...conn },
    })),

  setDsp: (dsp) =>
    set((state) => ({
      dsp: { ...state.dsp, ...dsp },
    })),

  setEqBand: (index, band) =>
    set((state) => ({
      dsp: {
        ...state.dsp,
        eq: state.dsp.eq.map((b, i) => (i === index ? { ...b, ...band } : b)),
      },
    })),

  setCompressor: (comp) =>
    set((state) => ({
      dsp: {
        ...state.dsp,
        compressor: { ...state.dsp.compressor, ...comp },
      },
    })),

  setLimiter: (limiter) =>
    set((state) => ({
      dsp: {
        ...state.dsp,
        limiter: { ...state.dsp.limiter, ...limiter },
      },
    })),

  setGate: (gate) =>
    set((state) => ({
      dsp: {
        ...state.dsp,
        gate: { ...state.dsp.gate, ...gate },
      },
    })),

  setMetadata: (meta) =>
    set((state) => ({
      metadata: { ...state.metadata, ...meta },
    })),

  setStreamHealth: (health) =>
    set((state) => ({
      streamHealth: { ...state.streamHealth, ...health },
    })),

  setLevels: (left, right, leftPeak, rightPeak) =>
    set({ leftLevel: left, rightLevel: right, leftPeak: leftPeak, rightPeak: rightPeak }),

  applyPreset: (preset) => {
    const presetData = presets[preset];
    if (presetData) {
      set((state) => ({
        dsp: { ...state.dsp, ...presetData, preset },
      }));
    }
  },
}));
