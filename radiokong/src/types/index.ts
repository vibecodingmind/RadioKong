// Type declarations for Electron API
export interface ElectronAPI {
  engineStart: (config: EngineConfig) => Promise<{ status: string }>;
  engineStop: () => Promise<{ status: string }>;
  engineCommand: (command: EngineCommand) => Promise<{ status: string }>;
  onEngineMessage: (callback: (message: EngineMessage) => void) => void;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  // Subscription / PesaPal
  subscriptionInitiate: (data: { tier: string; email: string }) => Promise<SubscriptionIPCResult>;
  subscriptionVerify: (trackingId: string) => Promise<SubscriptionVerifyResult>;
  subscriptionCancel: () => Promise<{ status: string }>;
  // Open external URL
  openExternal: (url: string) => Promise<{ status: string }>;
}

export interface SubscriptionIPCResult {
  status: string;
  trackingId?: string;
  redirectUrl?: string;
  orderId?: string;
  message?: string;
}

export interface SubscriptionVerifyResult {
  status: string;
  paymentStatus?: string;
  completed: boolean;
  tier?: string | null;
  amount?: number;
  currency?: string;
  message?: string;
}

export interface EngineConfig {
  server: ServerConfig;
  audio: AudioConfig;
  encoder: EncoderConfig;
  mixer: MixerConfig;
}

export interface ServerConfig {
  host: string;
  port: number;
  mount: string;
  username: string;
  password: string;
  protocol: 'icecast' | 'shoutcast';
}

export interface AudioConfig {
  device: string;
  sampleRate: number;
  channels: number;
  bufferSize: number;
}

export interface EncoderConfig {
  format: 'mp3' | 'ogg' | 'aac' | 'flac';
  bitrate: number;
  quality: number;
}

export interface MixerConfig {
  enabled: boolean;
  channels: MixerChannelConfig[];
}

export interface MixerChannelConfig {
  id: string;
  name: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  pan: number;
  device?: string;
}

export type EngineCommand =
  | { type: 'start'; config: EngineConfig }
  | { type: 'stop' }
  | { type: 'set_volume'; channel: string; volume: number }
  | { type: 'set_mute'; channel: string; muted: boolean }
  | { type: 'set_solo'; channel: string; solo: boolean }
  | { type: 'set_metadata'; title: string; artist: string }
  | { type: 'start_recording'; path: string }
  | { type: 'stop_recording' }
  | { type: 'list_devices' }
  | { type: 'add_server'; config: ServerConfig }
  | { type: 'remove_server'; id: string };

export interface EngineMessage {
  type: 'status' | 'vu_meter' | 'stream_status' | 'error' | 'devices';
  data: Record<string, unknown>;
}

export interface StreamStatus {
  connected: boolean;
  bytesSent: number;
  uptime: number;
  bitrate: number;
  format: string;
  server: string;
  mount: string;
}

export interface VUMeterData {
  channels: {
    left: number;
    right: number;
    peak_left: number;
    peak_right: number;
  }[];
}

export interface AudioDevice {
  id: string;
  name: string;
  isInput: boolean;
  isDefault: boolean;
  channels: number;
  sampleRates: number[];
}

export interface Recording {
  id: string;
  filename: string;
  path: string;
  startTime: Date;
  endTime?: Date;
  fileSize: number;
  format: string;
  duration: number;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
