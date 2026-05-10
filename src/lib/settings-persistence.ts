/**
 * RadioKong Settings Persistence
 *
 * Saves and loads app settings to/from localStorage so they survive page refreshes.
 */

const STORAGE_KEY = "radiokong-settings";

export interface PersistedSettings {
  streamConnection: {
    serverType: "icecast" | "shoutcast";
    host: string;
    port: number;
    password: string;
    mount: string;
    codec: "mp3" | "ogg" | "aac" | "opus" | "flac";
    bitrate: 64 | 96 | 128 | 192 | 256 | 320;
    autoReconnect: boolean;
  };
  dsp: {
    preset: string;
    eqBypass: boolean;
    eq: { frequency: number; gain: number; q: number }[];
    compressor: {
      threshold: number;
      ratio: number;
      attack: number;
      release: number;
      makeupGain: number;
      bypass: boolean;
    };
    limiter: {
      ceiling: number;
      release: number;
      bypass: boolean;
    };
    gate: {
      threshold: number;
      release: number;
      bypass: boolean;
    };
  };
  recordingsFolder: string;
}

export function saveSettings(settings: PersistedSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("[Settings] Failed to save:", err);
  }
}

export function loadSettings(): PersistedSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSettings;
  } catch (err) {
    console.error("[Settings] Failed to load:", err);
    return null;
  }
}

export function clearSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
