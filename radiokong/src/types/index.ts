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
  // Auth
  authLogin: (data: { email: string; password: string }) => Promise<AuthIPCResult>;
  authSignup: (data: { email: string; password: string; displayName: string }) => Promise<AuthIPCResult>;
  authLogout: () => Promise<{ status: string }>;
  // File dialogs
  showOpenDialog: (options?: ElectronDialogOptions) => Promise<ElectronDialogResult>;
  showSaveDialog: (options?: ElectronDialogOptions) => Promise<ElectronSaveDialogResult>;
  // File system
  showItemInFolder: (path: string) => Promise<{ status: string }>;
  openPath: (path: string) => Promise<{ status: string }>;
  deleteFile: (path: string) => Promise<{ status: string; message?: string }>;
}

export interface ElectronDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: string[];
}

export interface ElectronDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface ElectronSaveDialogResult {
  canceled: boolean;
  filePath: string;
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

export interface AuthIPCResult {
  status: string;
  user?: {
    id: string;
    email: string;
    displayName: string;
    avatar?: string;
    createdAt: string;
    tier: string;
  };
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
  | { type: 'start_recording'; path: string; format?: string }
  | { type: 'stop_recording' }
  | { type: 'list_devices' }
  | { type: 'add_server'; config: ServerConfig }
  | { type: 'remove_server'; id: string }
  | { type: 'set_output_device'; device: string }
  | { type: 'set_auto_reconnect'; enabled: boolean; max_attempts: number; interval_secs: number }
  | { type: 'test_connection'; config: ServerConfig }
  | { type: 'save_config'; path: string }
  | { type: 'load_config'; path: string }
  // DSP commands
  | { type: 'set_eq_band'; band_index: number; gain_db: number }
  | { type: 'set_eq_enabled'; enabled: boolean }
  | { type: 'set_compressor'; enabled?: boolean; threshold_db?: number; ratio?: number; attack_ms?: number; release_ms?: number; makeup_gain_db?: number }
  | { type: 'set_limiter'; enabled?: boolean; ceiling_db?: number; release_ms?: number }
  | { type: 'set_gate'; enabled?: boolean; threshold_db?: number; attack_ms?: number; release_ms?: number; hold_ms?: number }
  // Mixer commands
  | { type: 'add_channel'; id: string; name: string; volume: number; pan: number }
  | { type: 'remove_channel'; id: string }
  | { type: 'set_pan'; channel: string; pan: number }
  | { type: 'set_channel_device'; channel: string; device: string };

export interface EngineMessage {
  type: 'status' | 'vu_meter' | 'stream_status' | 'error' | 'devices' | 'waveform' | 'test_connection_result' | 'config_result' | 'recording_stopped';
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

export interface TestConnectionResult {
  success: boolean;
  message: string;
  server_type: string | null;
}

export interface ConfigResult {
  success: boolean;
  message: string;
  config: EngineConfig | null;
}

export interface RecordingStoppedData {
  path: string;
  duration_secs: number;
  file_size_bytes: number;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
