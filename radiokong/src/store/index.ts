import { create } from 'zustand'
import type { StreamStatus, VUMeterData, AudioDevice, EngineConfig, Recording, TestConnectionResult } from '../types'

export interface AdditionalServer {
  id: string
  host: string
  port: number
  mount: string
  username: string
  password: string
  protocol: 'icecast' | 'shoutcast'
  enabled: boolean
  label: string
}

interface AppState {
  // Stream state
  streamStatus: StreamStatus | null
  isStreaming: boolean
  isConnecting: boolean

  // Audio state
  vuMeters: VUMeterData | null
  audioDevices: AudioDevice[]
  selectedInputDevice: string
  selectedOutputDevice: string
  sampleRate: number
  bufferSize: number
  channels: number
  waveformData: number[] | null

  // Mixer state
  mixerChannels: MixerChannelState[]
  masterVolume: number
  masterMuted: boolean

  // Encoder state
  encoderFormat: 'mp3' | 'ogg' | 'aac' | 'flac'
  encoderBitrate: number

  // Server config
  serverConfig: {
    host: string
    port: number
    mount: string
    username: string
    password: string
    protocol: 'icecast' | 'shoutcast'
  }

  // Multi-server (Pro/Studio feature)
  additionalServers: AdditionalServer[]

  // Metadata
  currentMetadata: {
    title: string
    artist: string
  }

  // Recordings
  recordings: Recording[]
  isRecording: boolean

  // Test connection
  testConnectionResult: TestConnectionResult | null
  isTestingConnection: boolean

  // Save config status
  lastConfigSavePath: string | null

  // Engine errors (for displaying toast notifications)
  engineError: string | null

  // Actions
  setStreamStatus: (status: StreamStatus | null) => void
  setStreaming: (streaming: boolean) => void
  setConnecting: (connecting: boolean) => void
  setVUMeters: (data: VUMeterData) => void
  setAudioDevices: (devices: AudioDevice[]) => void
  setSelectedInputDevice: (id: string) => void
  setSelectedOutputDevice: (id: string) => void
  setSampleRate: (rate: number) => void
  setBufferSize: (size: number) => void
  setChannels: (ch: number) => void
  setWaveformData: (data: number[] | null) => void
  setMixerChannels: (channels: MixerChannelState[]) => void
  updateChannel: (id: string, updates: Partial<MixerChannelState>) => void
  addChannel: (channel: MixerChannelState) => void
  removeChannel: (id: string) => void
  setMasterVolume: (volume: number) => void
  setMasterMuted: (muted: boolean) => void
  setEncoderFormat: (format: 'mp3' | 'ogg' | 'aac' | 'flac') => void
  setEncoderBitrate: (bitrate: number) => void
  setServerConfig: (config: Partial<AppState['serverConfig']>) => void
  addAdditionalServer: (server: AdditionalServer) => void
  updateAdditionalServer: (id: string, updates: Partial<AdditionalServer>) => void
  removeAdditionalServer: (id: string) => void
  setMetadata: (metadata: Partial<AppState['currentMetadata']>) => void
  addRecording: (recording: Recording) => void
  setRecording: (recording: boolean) => void
  setTestConnectionResult: (result: TestConnectionResult | null) => void
  setTestingConnection: (testing: boolean) => void
  setLastConfigSavePath: (path: string | null) => void
  setEngineError: (error: string | null) => void
  getEngineConfig: () => EngineConfig
}

export interface MixerChannelState {
  id: string
  name: string
  volume: number
  muted: boolean
  solo: boolean
  pan: number
  color: string
  device?: string
  vuLevel: { left: number; right: number }
}

const CHANNEL_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

const DEFAULT_CHANNELS: MixerChannelState[] = [
  {
    id: 'mic',
    name: 'Microphone',
    volume: 0.8,
    muted: false,
    solo: false,
    pan: 0,
    color: '#10b981',
    vuLevel: { left: 0, right: 0 },
  },
  {
    id: 'music',
    name: 'Music / Line In',
    volume: 0.7,
    muted: false,
    solo: false,
    pan: 0,
    color: '#3b82f6',
    vuLevel: { left: 0, right: 0 },
  },
  {
    id: 'aux1',
    name: 'Aux 1',
    volume: 0.5,
    muted: true,
    solo: false,
    pan: 0,
    color: '#f59e0b',
    vuLevel: { left: 0, right: 0 },
  },
  {
    id: 'aux2',
    name: 'Aux 2',
    volume: 0.5,
    muted: true,
    solo: false,
    pan: 0,
    color: '#8b5cf6',
    vuLevel: { left: 0, right: 0 },
  },
]

export const useAppStore = create<AppState>((set, get) => ({
  // Stream state
  streamStatus: null,
  isStreaming: false,
  isConnecting: false,

  // Audio state
  vuMeters: null,
  audioDevices: [],
  selectedInputDevice: '',
  selectedOutputDevice: '',
  sampleRate: 44100,
  bufferSize: 2048,
  channels: 2,
  waveformData: null,

  // Mixer state
  mixerChannels: DEFAULT_CHANNELS,
  masterVolume: 0.8,
  masterMuted: false,

  // Encoder state
  encoderFormat: 'mp3',
  encoderBitrate: 192,

  // Server config
  serverConfig: {
    host: 'localhost',
    port: 8000,
    mount: '/live',
    username: 'source',
    password: '',
    protocol: 'icecast',
  },

  // Multi-server
  additionalServers: [],

  // Metadata
  currentMetadata: {
    title: '',
    artist: '',
  },

  // Recordings
  recordings: [],
  isRecording: false,

  // Test connection
  testConnectionResult: null,
  isTestingConnection: false,

  // Save config
  lastConfigSavePath: null,

  // Engine errors
  engineError: null,

  // Actions
  setStreamStatus: (status) => set({ streamStatus: status }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  setVUMeters: (data) => set({ vuMeters: data }),

  setAudioDevices: (devices) => set({ audioDevices: devices }),
  setSelectedInputDevice: (id) => set({ selectedInputDevice: id }),
  setSelectedOutputDevice: (id) => set({ selectedOutputDevice: id }),
  setSampleRate: (rate) => set({ sampleRate: rate }),
  setBufferSize: (size) => set({ bufferSize: size }),
  setChannels: (ch) => set({ channels: ch }),
  setWaveformData: (data) => set({ waveformData: data }),

  setMixerChannels: (channels) => set({ mixerChannels: channels }),
  updateChannel: (id, updates) =>
    set((state) => ({
      mixerChannels: state.mixerChannels.map((ch) =>
        ch.id === id ? { ...ch, ...updates } : ch
      ),
    })),
  addChannel: (channel) =>
    set((state) => ({
      mixerChannels: [...state.mixerChannels, channel],
    })),
  removeChannel: (id) =>
    set((state) => ({
      mixerChannels: state.mixerChannels.filter((ch) => ch.id !== id),
    })),

  setMasterVolume: (volume) => set({ masterVolume: volume }),
  setMasterMuted: (muted) => set({ masterMuted: muted }),

  setEncoderFormat: (format) => set({ encoderFormat: format }),
  setEncoderBitrate: (bitrate) => set({ encoderBitrate: bitrate }),

  setServerConfig: (config) =>
    set((state) => ({
      serverConfig: { ...state.serverConfig, ...config },
    })),

  addAdditionalServer: (server) =>
    set((state) => ({
      additionalServers: [...state.additionalServers, server],
    })),
  updateAdditionalServer: (id, updates) =>
    set((state) => ({
      additionalServers: state.additionalServers.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),
  removeAdditionalServer: (id) =>
    set((state) => ({
      additionalServers: state.additionalServers.filter((s) => s.id !== id),
    })),

  setMetadata: (metadata) =>
    set((state) => ({
      currentMetadata: { ...state.currentMetadata, ...metadata },
    })),

  addRecording: (recording) =>
    set((state) => ({
      recordings: [...state.recordings, recording],
    })),
  setRecording: (recording) => set({ isRecording: recording }),

  setTestConnectionResult: (result) => set({ testConnectionResult: result }),
  setTestingConnection: (testing) => set({ isTestingConnection: testing }),
  setLastConfigSavePath: (path) => set({ lastConfigSavePath: path }),
  setEngineError: (error) => set({ engineError: error }),

  getEngineConfig: () => {
    const state = get()
    return {
      server: state.serverConfig,
      audio: {
        device: state.selectedInputDevice,
        sampleRate: state.sampleRate,
        channels: state.channels,
        bufferSize: state.bufferSize,
      },
      encoder: {
        format: state.encoderFormat,
        bitrate: state.encoderBitrate,
        quality: 5,
      },
      mixer: {
        enabled: true,
        channels: state.mixerChannels.map((ch) => ({
          id: ch.id,
          name: ch.name,
          volume: ch.volume,
          muted: ch.muted,
          solo: ch.solo,
          pan: ch.pan,
          device: ch.device,
        })),
      },
    }
  },
}))

export { CHANNEL_COLORS }
