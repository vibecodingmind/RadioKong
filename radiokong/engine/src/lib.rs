//! RadioKong Audio Engine
//!
//! Core library for audio capture, processing, encoding, and streaming.
//! This engine handles the low-level audio pipeline:
//!   1. Capture audio from input devices (via CPAL)
//!   2. Process through mixer and DSP pipeline
//!   3. Encode to MP3/OGG/AAC/FLAC
//!   4. Stream to Icecast/SHOUTcast servers

pub mod capture;
pub mod encoder;
pub mod streamer;
pub mod mixer;
pub mod dsp;

use serde::{Deserialize, Serialize};
use std::fmt;

/// Server configuration for Icecast/SHOUTcast connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub mount: String,
    pub username: String,
    pub password: String,
    pub protocol: StreamProtocol,
}

/// Supported streaming protocols
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum StreamProtocol {
    Icecast,
    Shoutcast,
}

impl fmt::Display for StreamProtocol {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StreamProtocol::Icecast => write!(f, "icecast"),
            StreamProtocol::Shoutcast => write!(f, "shoutcast"),
        }
    }
}

/// Audio device configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioConfig {
    pub device: String,
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: u32,
}

/// Encoder configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncoderConfig {
    pub format: EncoderFormat,
    pub bitrate: u32,
    pub quality: u8,
}

/// Supported audio encoding formats
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum EncoderFormat {
    Mp3,
    Ogg,
    Aac,
    Flac,
}

impl fmt::Display for EncoderFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EncoderFormat::Mp3 => write!(f, "mp3"),
            EncoderFormat::Ogg => write!(f, "ogg"),
            EncoderFormat::Aac => write!(f, "aac"),
            EncoderFormat::Flac => write!(f, "flac"),
        }
    }
}

/// Mixer configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MixerConfig {
    pub enabled: bool,
    pub channels: Vec<MixerChannelConfig>,
}

/// Individual mixer channel configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MixerChannelConfig {
    pub id: String,
    pub name: String,
    pub volume: f32,
    pub muted: bool,
    pub solo: bool,
    pub pan: f32,
    pub device: Option<String>,
}

/// Complete engine configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    pub server: ServerConfig,
    pub audio: AudioConfig,
    pub encoder: EncoderConfig,
    pub mixer: MixerConfig,
}

/// Messages sent from the engine to the UI
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum EngineMessage {
    /// Current stream status
    #[serde(rename = "stream_status")]
    StreamStatus {
        connected: bool,
        bytes_sent: u64,
        uptime: u64,
        bitrate: u32,
        format: String,
        server: String,
        mount: String,
    },
    /// VU meter levels
    #[serde(rename = "vu_meter")]
    VuMeter {
        channels: Vec<ChannelVU>,
    },
    /// Available audio devices
    #[serde(rename = "devices")]
    Devices {
        list: Vec<DeviceInfo>,
    },
    /// General status message
    #[serde(rename = "status")]
    Status {
        message: String,
    },
    /// Error message
    #[serde(rename = "error")]
    Error {
        message: String,
        code: Option<String>,
    },
    /// Waveform data for display
    #[serde(rename = "waveform")]
    Waveform {
        samples: Vec<f32>,
    },
    /// Test connection result
    #[serde(rename = "test_connection_result")]
    TestConnectionResult {
        success: bool,
        message: String,
        server_type: Option<String>,
    },
    /// Configuration saved/loaded
    #[serde(rename = "config_result")]
    ConfigResult {
        success: bool,
        message: String,
        config: Option<EngineConfig>,
    },
    /// Recording stopped with file info
    #[serde(rename = "recording_stopped")]
    RecordingStopped {
        path: String,
        duration_secs: f64,
        file_size_bytes: u64,
    },
}

/// VU meter data for a single channel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelVU {
    pub left: f32,
    pub right: f32,
    pub peak_left: f32,
    pub peak_right: f32,
}

/// Audio device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub is_input: bool,
    pub is_default: bool,
    pub channels: u16,
    pub sample_rates: Vec<u32>,
}

/// Commands received from the UI
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum EngineCommand {
    #[serde(rename = "start")]
    Start { config: EngineConfig },
    #[serde(rename = "stop")]
    Stop,
    #[serde(rename = "set_volume")]
    SetVolume { channel: String, volume: f32 },
    #[serde(rename = "set_mute")]
    SetMute { channel: String, muted: bool },
    #[serde(rename = "set_solo")]
    SetSolo { channel: String, solo: bool },
    #[serde(rename = "set_metadata")]
    SetMetadata { title: String, artist: String },
    #[serde(rename = "start_recording")]
    StartRecording { path: String },
    #[serde(rename = "stop_recording")]
    StopRecording,
    #[serde(rename = "list_devices")]
    ListDevices,
    /// Add a secondary streaming server (multi-output)
    #[serde(rename = "add_server")]
    AddServer { config: ServerConfig },
    /// Remove a secondary streaming server by ID
    #[serde(rename = "remove_server")]
    RemoveServer { id: String },
    /// Set the output (monitor) device
    #[serde(rename = "set_output_device")]
    SetOutputDevice { device: String },
    /// Enable or disable auto-reconnect
    #[serde(rename = "set_auto_reconnect")]
    SetAutoReconnect { enabled: bool, max_attempts: u32, interval_secs: u64 },
    /// Test connection to a server without starting the full pipeline
    #[serde(rename = "test_connection")]
    TestConnection { config: ServerConfig },
    /// Save current configuration
    #[serde(rename = "save_config")]
    SaveConfig { path: String },
    /// Load configuration from file
    #[serde(rename = "load_config")]
    LoadConfig { path: String },

    // ---- DSP Commands ----
    /// Set EQ band gain
    #[serde(rename = "set_eq_band")]
    SetEQBand { band_index: usize, gain_db: f32 },
    /// Enable or disable EQ
    #[serde(rename = "set_eq_enabled")]
    SetEQEnabled { enabled: bool },
    /// Set compressor parameters
    #[serde(rename = "set_compressor")]
    SetCompressor {
        enabled: Option<bool>,
        threshold_db: Option<f32>,
        ratio: Option<f32>,
        attack_ms: Option<f32>,
        release_ms: Option<f32>,
        makeup_gain_db: Option<f32>,
    },
    /// Set limiter parameters
    #[serde(rename = "set_limiter")]
    SetLimiter {
        enabled: Option<bool>,
        ceiling_db: Option<f32>,
        release_ms: Option<f32>,
    },
    /// Set noise gate parameters
    #[serde(rename = "set_gate")]
    SetGate {
        enabled: Option<bool>,
        threshold_db: Option<f32>,
        attack_ms: Option<f32>,
        release_ms: Option<f32>,
        hold_ms: Option<f32>,
    },

    // ---- Mixer Commands ----
    /// Add a new mixer channel
    #[serde(rename = "add_channel")]
    AddChannel { id: String, name: String, volume: f32, pan: f32 },
    /// Remove a mixer channel
    #[serde(rename = "remove_channel")]
    RemoveChannel { id: String },
    /// Set channel pan
    #[serde(rename = "set_pan")]
    SetPan { channel: String, pan: f32 },
    /// Set channel input device
    #[serde(rename = "set_channel_device")]
    SetChannelDevice { channel: String, device: String },
}
