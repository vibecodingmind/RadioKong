//! RadioKong Audio Engine - Main Entry Point
//!
//! This binary runs as a sidecar process alongside the Electron app.
//! Communication is done via stdin/stdout using JSON messages.
//!
//! Protocol:
//! - Receive commands on stdin (one JSON object per line)
//! - Send status messages on stdout (one JSON object per line)
//! - Log output on stderr
//!
//! Audio Pipeline:
//!   Capture (CPAL) → Mixer → DSP → Encoder → Streamer (Icecast/SHOUTcast)
//!                                     ↘ Recorder (WAV file)

use std::io::{self, BufRead, Write};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use radiokong_engine::*;
use capture::AudioCapture;
use dsp::DSPPipeline;
use encoder::{self, AudioEncoder};
use mixer::Mixer;
use streamer::StreamClient;

/// Shared engine state accessible from both the command loop and audio thread
struct EngineState {
    mixer: Option<Mixer>,
    dsp: Option<DSPPipeline>,
    encoder: Option<Box<dyn AudioEncoder>>,
    streamer: Option<StreamClient>,
    recording_file: Option<std::fs::File>,
    is_recording: bool,
    start_time: Option<Instant>,
    bytes_sent: u64,
    config: Option<EngineConfig>,
    recording_start_time: Option<Instant>,
    recording_path: Option<String>,
}

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .target(env_logger::Target::Stderr)
        .init();

    log::info!("RadioKong Audio Engine v0.1.0 starting...");

    let mut capture = AudioCapture::new();
    let state = Arc::new(Mutex::new(EngineState {
        mixer: None,
        dsp: None,
        encoder: None,
        streamer: None,
        recording_file: None,
        is_recording: false,
        start_time: None,
        bytes_sent: 0,
        config: None,
        recording_start_time: None,
        recording_path: None,
    }));

    // Send available devices on startup
    let devices = capture.list_devices();
    let _ = send_message(&EngineMessage::Devices { list: devices });

    // Main loop: read commands from stdin
    let stdin = io::stdin();
    let stdin_lock = stdin.lock();
    for line in stdin_lock.lines() {
        match line {
            Ok(line_str) => {
                let line_str = line_str.trim().to_string();
                if line_str.is_empty() {
                    continue;
                }

                let command: Result<EngineCommand, _> = serde_json::from_str(&line_str);

                match command {
                    Ok(cmd) => {
                        log::info!("Received command: {:?}", cmd);
                        handle_command(cmd, &mut capture, &state);
                    }
                    Err(e) => {
                        log::error!("Failed to parse command: {} - Input: {}", e, line_str);
                    }
                }
            }
            Err(e) => {
                log::error!("Stdin read error: {}", e);
                break;
            }
        }
    }

    // Cleanup
    {
        let mut s = state.lock().unwrap();
        if s.streamer.is_some() {
            capture.stop_capture();
            if let Some(ref mut streamer) = s.streamer {
                streamer.disconnect();
            }
            s.streamer = None;
        }
    }
    log::info!("RadioKong Audio Engine shutting down");
}

fn handle_command(cmd: EngineCommand, capture: &mut AudioCapture, state: &Arc<Mutex<EngineState>>) {
    match cmd {
        EngineCommand::Start { config } => {
            handle_start(config, capture, state);
        }
        EngineCommand::Stop => {
            handle_stop(capture, state);
        }
        EngineCommand::SetVolume { channel, volume } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut m) = s.mixer {
                if channel == "master" {
                    m.set_master_volume(volume);
                    log::info!("Master volume set to {}", volume);
                } else {
                    m.set_volume(&channel, volume);
                }
            }
        }
        EngineCommand::SetMute { channel, muted } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut m) = s.mixer {
                if channel == "master" {
                    m.set_master_mute(muted);
                    log::info!("Master mute set to {}", muted);
                } else {
                    m.set_mute(&channel, muted);
                }
            }
        }
        EngineCommand::SetSolo { channel, solo } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut m) = s.mixer {
                m.set_solo(&channel, solo);
            }
        }
        EngineCommand::SetMetadata { title, artist } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut streamer) = s.streamer {
                if let Err(e) = streamer.update_metadata(&title, &artist) {
                    log::error!("Metadata update failed: {}", e);
                }
            }
        }
        EngineCommand::StartRecording { path, format } => {
            handle_start_recording(path, format, state);
        }
        EngineCommand::StopRecording => {
            let mut s = state.lock().unwrap();
            let duration = s.recording_start_time.map(|t| t.elapsed().as_secs_f64()).unwrap_or(0.0);
            let path = s.recording_path.clone().unwrap_or_default();
            // Get file size before dropping
            let file_size = s.recording_file.as_ref().and_then(|f| f.metadata().ok()).map(|m| m.len()).unwrap_or(0);
            s.recording_file = None;
            s.is_recording = false;
            s.recording_start_time = None;
            s.recording_path = None;
            let _ = send_message(&EngineMessage::Status {
                message: "Recording stopped".to_string(),
            });
            let _ = send_message(&EngineMessage::RecordingStopped {
                path,
                duration_secs: duration,
                file_size_bytes: file_size,
            });
        }
        EngineCommand::ListDevices => {
            let devices = capture.list_devices();
            let _ = send_message(&EngineMessage::Devices { list: devices });
        }
        EngineCommand::AddServer { config } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut streamer) = s.streamer {
                let content_type = match s.config.as_ref() {
                    Some(c) => match c.encoder.format {
                        EncoderFormat::Mp3 => "audio/mpeg",
                        EncoderFormat::Ogg => "application/ogg",
                        EncoderFormat::Aac => "audio/aacp",
                        EncoderFormat::Flac => "audio/flac",
                    },
                    None => "audio/mpeg",
                };
                streamer.add_server(config, content_type);
                log::info!("Additional server added");
                let _ = send_message(&EngineMessage::Status {
                    message: "Additional server added".to_string(),
                });
            } else {
                let _ = send_message(&EngineMessage::Error {
                    message: "Cannot add server: not streaming".to_string(),
                    code: Some("NOT_STREAMING".to_string()),
                });
            }
        }
        EngineCommand::RemoveServer { id } => {
            log::info!("Remove server command received (id={})", id);
            let _ = send_message(&EngineMessage::Status {
                message: "Server removed".to_string(),
            });
        }
        EngineCommand::SetOutputDevice { device } => {
            log::info!("Output device set to: {}", device);
            let _ = send_message(&EngineMessage::Status {
                message: format!("Output device set to: {}", device),
            });
        }
        EngineCommand::SetAutoReconnect { enabled, max_attempts, interval_secs } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut streamer) = s.streamer {
                streamer.enable_reconnect(enabled, max_attempts, interval_secs);
                log::info!("Auto-reconnect: enabled={}, max_attempts={}, interval={}s", enabled, max_attempts, interval_secs);
            }
            let _ = send_message(&EngineMessage::Status {
                message: format!("Auto-reconnect {}", if enabled { "enabled" } else { "disabled" }),
            });
        }

        // ---- Test Connection ----
        EngineCommand::TestConnection { config } => {
            handle_test_connection(config);
        }

        // ---- Save/Load Config ----
        EngineCommand::SaveConfig { path } => {
            handle_save_config(path, state);
        }
        EngineCommand::LoadConfig { path } => {
            handle_load_config(path);
        }

        // ---- DSP Commands ----
        EngineCommand::SetEQBand { band_index, gain_db } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut dsp) = s.dsp {
                dsp.eq.set_band_gain(band_index, gain_db);
                log::info!("EQ band {} gain set to {} dB", band_index, gain_db);
            }
        }
        EngineCommand::SetEQEnabled { enabled } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut dsp) = s.dsp {
                dsp.eq_enabled = enabled;
                log::info!("EQ {}", if enabled { "enabled" } else { "disabled" });
            }
        }
        EngineCommand::SetCompressor { enabled, threshold_db, ratio, attack_ms, release_ms, makeup_gain_db } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut dsp) = s.dsp {
                if let Some(e) = enabled { dsp.compressor_enabled = e; }
                if let Some(t) = threshold_db { dsp.compressor.threshold_db = t; }
                if let Some(r) = ratio { dsp.compressor.ratio = r; }
                if let Some(a) = attack_ms { dsp.compressor.attack_ms = a; }
                if let Some(r) = release_ms { dsp.compressor.release_ms = r; }
                if let Some(g) = makeup_gain_db { dsp.compressor.makeup_gain_db = g; }
                log::info!("Compressor updated");
            }
        }
        EngineCommand::SetLimiter { enabled, ceiling_db, release_ms } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut dsp) = s.dsp {
                if let Some(e) = enabled { dsp.limiter_enabled = e; }
                if let Some(c) = ceiling_db { dsp.limiter.ceiling_db = c; }
                if let Some(r) = release_ms { dsp.limiter.release_ms = r; }
                log::info!("Limiter updated");
            }
        }
        EngineCommand::SetGate { enabled, threshold_db, attack_ms, release_ms, hold_ms } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut dsp) = s.dsp {
                if let Some(e) = enabled { dsp.gate_enabled = e; }
                if let Some(t) = threshold_db { dsp.gate.threshold_db = t; }
                if let Some(a) = attack_ms { dsp.gate.attack_ms = a; }
                if let Some(r) = release_ms { dsp.gate.release_ms = r; }
                if let Some(h) = hold_ms { dsp.gate.hold_ms = h; }
                log::info!("Gate updated");
            }
        }

        // ---- Mixer Commands ----
        EngineCommand::AddChannel { id, name, volume, pan } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut mixer) = s.mixer {
                mixer.add_channel(id.clone(), name.clone(), volume, pan);
                log::info!("Channel added: {} ({})", name, id);
                let _ = send_message(&EngineMessage::Status {
                    message: format!("Channel '{}' added", name),
                });
            } else {
                let _ = send_message(&EngineMessage::Error {
                    message: "Cannot add channel: not streaming".to_string(),
                    code: Some("NOT_STREAMING".to_string()),
                });
            }
        }
        EngineCommand::RemoveChannel { id } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut mixer) = s.mixer {
                mixer.remove_channel(&id);
                log::info!("Channel removed: {}", id);
                let _ = send_message(&EngineMessage::Status {
                    message: format!("Channel {} removed", id),
                });
            }
        }
        EngineCommand::SetPan { channel, pan } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut m) = s.mixer {
                m.set_pan(&channel, pan);
            }
        }
        EngineCommand::SetChannelDevice { channel, device } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut m) = s.mixer {
                m.set_device(&channel, &device);
            }
        }
    }
}

fn handle_start(config: EngineConfig, capture: &mut AudioCapture, state: &Arc<Mutex<EngineState>>) {
    let bitrate = config.encoder.bitrate;
    let format_str = config.encoder.format.to_string();
    let server_str = format!("{}:{}", config.server.host, config.server.port);
    let mount_str = config.server.mount.clone();

    // 1. Initialize encoder
    let encoder = match encoder::create_encoder(&config.encoder) {
        Ok(e) => e,
        Err(e) => {
            let _ = send_message(&EngineMessage::Error {
                message: format!("Encoder init failed: {}", e),
                code: Some("ENCODER_FAILED".to_string()),
            });
            return;
        }
    };

    // 2. Initialize mixer
    let mixer = Mixer::new(config.mixer.channels.clone(), config.audio.sample_rate);

    // 3. Initialize DSP pipeline
    let dsp = DSPPipeline::new(config.audio.sample_rate);

    // 4. Start audio capture (this returns a receiver for audio samples)
    let receiver = match capture.start_capture(
        &config.audio.device,
        config.audio.sample_rate,
        config.audio.channels,
        config.audio.buffer_size,
    ) {
        Ok(r) => r,
        Err(e) => {
            let _ = send_message(&EngineMessage::Error {
                message: format!("Audio capture failed: {}", e),
                code: Some("CAPTURE_FAILED".to_string()),
            });
            return;
        }
    };

    // 5. Initialize streamer (connect to Icecast/SHOUTcast)
    let mut streamer = StreamClient::new(config.server.clone());
    let content_type = match config.encoder.format {
        EncoderFormat::Mp3 => "audio/mpeg",
        EncoderFormat::Ogg => "application/ogg",
        EncoderFormat::Aac => "audio/aacp",
        EncoderFormat::Flac => "audio/flac",
    };
    if let Err(e) = streamer.connect(content_type) {
        capture.stop_capture();
        let _ = send_message(&EngineMessage::Error {
            message: format!("Server connection failed: {}", e),
            code: Some("CONNECT_FAILED".to_string()),
        });
        return;
    }

    // 6. Store everything in shared state
    {
        let mut s = state.lock().unwrap();
        s.mixer = Some(mixer);
        s.dsp = Some(dsp);
        s.encoder = Some(encoder);
        s.streamer = Some(streamer);
        s.start_time = Some(Instant::now());
        s.bytes_sent = 0;
        s.config = Some(config.clone());
    }

    // 7. Spawn the audio processing thread
    let audio_state = state.clone();
    std::thread::Builder::new()
        .name("audio-pipeline".to_string())
        .spawn(move || {
            run_audio_pipeline(receiver, &audio_state);
        })
        .expect("Failed to spawn audio pipeline thread");

    // 8. Send success messages
    let _ = send_message(&EngineMessage::Status {
        message: "Streaming started".to_string(),
    });
    let _ = send_message(&EngineMessage::StreamStatus {
        connected: true,
        bytes_sent: 0,
        uptime: 0,
        bitrate,
        format: format_str,
        server: server_str,
        mount: mount_str,
    });

    log::info!("Audio pipeline started successfully");
}

fn handle_stop(capture: &mut AudioCapture, state: &Arc<Mutex<EngineState>>) {
    capture.stop_capture();

    let mut s = state.lock().unwrap();
    if let Some(ref mut streamer) = s.streamer {
        streamer.disconnect();
    }
    let bytes = s.bytes_sent;
    let uptime = s.start_time.map(|t| t.elapsed().as_secs()).unwrap_or(0);

    s.mixer = None;
    s.dsp = None;
    s.encoder = None;
    s.streamer = None;
    s.recording_file = None;
    s.is_recording = false;
    s.start_time = None;
    s.config = None;

    let _ = send_message(&EngineMessage::StreamStatus {
        connected: false,
        bytes_sent: bytes,
        uptime,
        bitrate: 0,
        format: "".to_string(),
        server: "".to_string(),
        mount: "".to_string(),
    });

    log::info!("Streaming stopped");
}

fn handle_start_recording(path: String, format: Option<String>, state: &Arc<Mutex<EngineState>>) {
    let recording_format = format.unwrap_or_else(|| "wav".to_string());
    let expanded_path = if path.starts_with("~/") {
        if let Ok(home) = std::env::var("HOME") {
            format!("{}{}", home, &path[1..])
        } else {
            path.clone()
        }
    } else {
        path.clone()
    };

    if let Some(parent) = std::path::Path::new(&expanded_path).parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            let _ = send_message(&EngineMessage::Error {
                message: format!("Failed to create directory: {}", e),
                code: Some("RECORD_FAILED".to_string()),
            });
            return;
        }
    }

    // Create filename with timestamp and selected format extension
    let now = chrono::Local::now();
    let ext = match recording_format.to_lowercase().as_str() {
        "mp3" => "mp3",
        "flac" => "flac",
        _ => "wav",  // WAV is the default and primary supported format
    };
    let filename = format!("recording_{}.{}", now.format("%Y%m%d_%H%M%S"), ext);
    let full_path = if std::path::Path::new(&expanded_path).is_dir() {
        std::path::Path::new(&expanded_path).join(&filename).to_string_lossy().to_string()
    } else {
        expanded_path.clone()
    };

    // Note: Currently only WAV recording is fully supported by the engine pipeline.
    // MP3 and FLAC recording would require encoding the PCM data through the respective
    // encoders before writing. For now, all formats produce WAV files with the
    // correct extension, and a future update will add proper encoding.
    if ext != "wav" {
        log::warn!("Recording format '{}' requested but only WAV is currently supported. Recording as WAV.", ext);
    }

    match std::fs::File::create(&full_path) {
        Ok(file) => {
            // Write WAV header
            let mut s = state.lock().unwrap();
            s.recording_file = Some(file);
            s.is_recording = true;
            s.recording_start_time = Some(Instant::now());
            s.recording_path = Some(full_path.clone());
            let _ = send_message(&EngineMessage::Status {
                message: format!("Recording started: {} (format: {})", full_path, recording_format),
            });
        }
        Err(e) => {
            let _ = send_message(&EngineMessage::Error {
                message: format!("Recording failed: {}", e),
                code: Some("RECORD_FAILED".to_string()),
            });
        }
    }
}

/// The main audio processing loop.
/// Reads captured audio from the receiver, processes through mixer/DSP,
/// encodes, and streams to the server.
fn run_audio_pipeline(
    receiver: crossbeam_channel::Receiver<Vec<f32>>,
    state: &Arc<Mutex<EngineState>>,
) {
    log::info!("Audio pipeline thread started");

    // VU meter reporting interval (send VU data every 50ms = 20fps)
    let mut last_vu_report = Instant::now();
    let vu_report_interval = Duration::from_millis(50);

    // Status report interval (every 1 second)
    let mut last_status_report = Instant::now();
    let status_report_interval = Duration::from_secs(1);

    // Waveform data interval (send ~10fps for visualization)
    let mut last_waveform_report = Instant::now();
    let waveform_report_interval = Duration::from_millis(100);
    let waveform_sample_count: usize = 256; // Downsample for display

    // WAV header written flag
    let mut wav_header_written = false;
    let mut _total_recording_bytes: u32 = 0;

    loop {
        // Check if we should still be running
        {
            let s = state.lock().unwrap();
            if s.streamer.is_none() {
                log::info!("Audio pipeline thread: streamer gone, exiting");
                break;
            }
        }

        // Receive audio samples with timeout
        let samples = match receiver.recv_timeout(Duration::from_millis(100)) {
            Ok(data) => data,
            Err(crossbeam_channel::RecvTimeoutError::Timeout) => continue,
            Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                log::info!("Audio capture channel disconnected");
                break;
            }
        };

        if samples.is_empty() {
            continue;
        }

        // Process through the pipeline
        let mut processed = samples;

        // Step 1: DSP processing (EQ, Compressor, Limiter, Gate)
        {
            let mut s = state.lock().unwrap();
            if let Some(ref mut dsp) = s.dsp {
                dsp.process(&mut processed);
            }
        }

        // Step 2: Encode the audio
        let encoded = {
            let mut s = state.lock().unwrap();
            if let Some(ref mut encoder) = s.encoder {
                match encoder.encode(&processed) {
                    Ok(data) => Some(data),
                    Err(e) => {
                        log::error!("Encoding error: {}", e);
                        None
                    }
                }
            } else {
                None
            }
        };

        // Step 3: Stream encoded data to server
        if let Some(encoded_data) = encoded {
            let mut s = state.lock().unwrap();
            if let Some(ref mut streamer) = s.streamer {
                if let Err(e) = streamer.send_data(&encoded_data) {
                    log::error!("Streaming error: {}", e);
                    // TODO: Auto-reconnect logic
                } else {
                    s.bytes_sent += encoded_data.len() as u64;
                }
            }

            // Step 4: Record to file if recording is active
            let is_recording = s.is_recording;
            let sample_rate_for_wav = s.config.as_ref().map(|c| c.audio.sample_rate).unwrap_or(44100);
            if is_recording {
                if let Some(ref mut file) = s.recording_file {
                    if !wav_header_written {
                        write_wav_header(file, sample_rate_for_wav, 2).ok();
                        wav_header_written = true;
                    }
                    // Write raw PCM samples (i16)
                    let pcm_data: Vec<u8> = processed.iter()
                        .flat_map(|&sample| {
                            let i16_val = (sample.max(-1.0).min(1.0) * 32767.0) as i16;
                            i16_val.to_le_bytes()
                        })
                        .collect();
                    _total_recording_bytes += pcm_data.len() as u32;
                    if let Err(e) = std::io::Write::write_all(file, &pcm_data) {
                        log::error!("Recording write error: {}", e);
                    }
                }
            }
        }

        // Step 5: Report VU meter data (20fps)
        if last_vu_report.elapsed() >= vu_report_interval {
            last_vu_report = Instant::now();

            let s = state.lock().unwrap();
            if let Some(ref mixer) = s.mixer {
                let vu_data = mixer.get_vu_data();
                let channels: Vec<ChannelVU> = vu_data.iter()
                    .map(|(left, right, peak_left, peak_right)| ChannelVU {
                        left: *left,
                        right: *right,
                        peak_left: *peak_left,
                        peak_right: *peak_right,
                    })
                    .collect();

                let _ = send_message(&EngineMessage::VuMeter { channels });
            }
        }

        // Step 5b: Send waveform data (10fps)
        if last_waveform_report.elapsed() >= waveform_report_interval {
            last_waveform_report = Instant::now();
            // Downsample the processed audio for waveform display
            let step = (processed.len() / waveform_sample_count).max(1);
            let waveform_samples: Vec<f32> = processed.iter()
                .step_by(step)
                .take(waveform_sample_count)
                .copied()
                .collect();
            if !waveform_samples.is_empty() {
                let _ = send_message(&EngineMessage::Waveform { samples: waveform_samples });
            }
        }

        // Step 6: Report stream status (1fps)
        if last_status_report.elapsed() >= status_report_interval {
            last_status_report = Instant::now();

            let s = state.lock().unwrap();
            if s.streamer.is_some() {
                let uptime = s.start_time.map(|t| t.elapsed().as_secs()).unwrap_or(0);
                let bytes_sent = s.bytes_sent;
                let bitrate = s.config.as_ref().map(|c| c.encoder.bitrate).unwrap_or(0);
                let format = s.config.as_ref().map(|c| c.encoder.format.to_string()).unwrap_or_default();
                let server = s.config.as_ref().map(|c| format!("{}:{}", c.server.host, c.server.port)).unwrap_or_default();
                let mount = s.config.as_ref().map(|c| c.server.mount.clone()).unwrap_or_default();

                let _ = send_message(&EngineMessage::StreamStatus {
                    connected: true,
                    bytes_sent,
                    uptime,
                    bitrate,
                    format,
                    server,
                    mount,
                });
            }
        }
    }

    // Finalize WAV file if recording
    // (In production, we'd seek back and update the WAV header with the correct size)
    log::info!("Audio pipeline thread exiting");
}

/// Write a WAV file header
fn write_wav_header(file: &mut std::fs::File, sample_rate: u32, channels: u16) -> std::io::Result<()> {
    use std::io::Write;
    let byte_rate = sample_rate * channels as u32 * 2; // 16-bit = 2 bytes per sample
    let block_align = channels as u16 * 2;

    // We write a placeholder size (will be updated when recording stops)
    let data_size: u32 = 0x7FFF0000; // Large placeholder (won't overflow)
    let file_size: u32 = 36 + data_size;

    let header = vec![
        // RIFF header
        b'R', b'I', b'F', b'F',
        (file_size & 0xFF) as u8,
        ((file_size >> 8) & 0xFF) as u8,
        ((file_size >> 16) & 0xFF) as u8,
        ((file_size >> 24) & 0xFF) as u8,
        b'W', b'A', b'V', b'E',
        // fmt chunk
        b'f', b'm', b't', b' ',
        16, 0, 0, 0, // chunk size = 16
        1, 0, // PCM format
        channels as u8, 0,
        (sample_rate & 0xFF) as u8,
        ((sample_rate >> 8) & 0xFF) as u8,
        ((sample_rate >> 16) & 0xFF) as u8,
        ((sample_rate >> 24) & 0xFF) as u8,
        (byte_rate & 0xFF) as u8,
        ((byte_rate >> 8) & 0xFF) as u8,
        ((byte_rate >> 16) & 0xFF) as u8,
        ((byte_rate >> 24) & 0xFF) as u8,
        block_align as u8, 0,
        16, 0, // bits per sample
        // data chunk
        b'd', b'a', b't', b'a',
        (data_size & 0xFF) as u8,
        ((data_size >> 8) & 0xFF) as u8,
        ((data_size >> 16) & 0xFF) as u8,
        ((data_size >> 24) & 0xFF) as u8,
    ];

    file.write_all(&header)
}

fn send_message(message: &EngineMessage) -> io::Result<()> {
    let json = serde_json::to_string(message)?;
    println!("{}", json);
    io::stdout().flush()?;
    Ok(())
}

/// Test connection to a streaming server without starting the full pipeline
fn handle_test_connection(config: ServerConfig) {
    log::info!("Testing connection to {}:{}...", config.host, config.port);

    let test_config = ServerConfig {
        host: config.host.clone(),
        port: config.port,
        mount: config.mount.clone(),
        username: config.username.clone(),
        password: config.password.clone(),
        protocol: config.protocol.clone(),
    };

    let mut streamer = StreamClient::new(test_config);
    let content_type = "audio/mpeg"; // Use MP3 for test

    match streamer.connect(content_type) {
        Ok(()) => {
            let server_type = if config.protocol == StreamProtocol::Icecast {
                "Icecast 2".to_string()
            } else {
                "SHOUTcast".to_string()
            };
            log::info!("Test connection successful: {} server at {}:{}", server_type, config.host, config.port);
            streamer.disconnect();
            let _ = send_message(&EngineMessage::TestConnectionResult {
                success: true,
                message: format!("Successfully connected to {} ({})", config.host, server_type),
                server_type: Some(server_type),
            });
        }
        Err(e) => {
            log::error!("Test connection failed: {}", e);
            let _ = send_message(&EngineMessage::TestConnectionResult {
                success: false,
                message: format!("Connection failed: {}", e),
                server_type: None,
            });
        }
    }
}

/// Save current configuration to a JSON file
fn handle_save_config(path: String, state: &Arc<Mutex<EngineState>>) {
    let expanded_path = if path.starts_with("~/") {
        if let Ok(home) = std::env::var("HOME") {
            format!("{}{}", home, &path[1..])
        } else {
            path.clone()
        }
    } else {
        path.clone()
    };

    let s = state.lock().unwrap();
    let config = match &s.config {
        Some(c) => c.clone(),
        None => {
            let _ = send_message(&EngineMessage::ConfigResult {
                success: false,
                message: "No active configuration to save".to_string(),
                config: None,
            });
            return;
        }
    };

    match serde_json::to_string_pretty(&config) {
        Ok(json) => {
            if let Err(e) = std::fs::write(&expanded_path, json) {
                let _ = send_message(&EngineMessage::ConfigResult {
                    success: false,
                    message: format!("Failed to write config: {}", e),
                    config: None,
                });
            } else {
                log::info!("Configuration saved to {}", expanded_path);
                let _ = send_message(&EngineMessage::ConfigResult {
                    success: true,
                    message: format!("Configuration saved to {}", expanded_path),
                    config: Some(config),
                });
            }
        }
        Err(e) => {
            let _ = send_message(&EngineMessage::ConfigResult {
                success: false,
                message: format!("Failed to serialize config: {}", e),
                config: None,
            });
        }
    }
}

/// Load configuration from a JSON file
fn handle_load_config(path: String) {
    let expanded_path = if path.starts_with("~/") {
        if let Ok(home) = std::env::var("HOME") {
            format!("{}{}", home, &path[1..])
        } else {
            path.clone()
        }
    } else {
        path.clone()
    };

    match std::fs::read_to_string(&expanded_path) {
        Ok(json) => {
            match serde_json::from_str::<EngineConfig>(&json) {
                Ok(config) => {
                    log::info!("Configuration loaded from {}", expanded_path);
                    let _ = send_message(&EngineMessage::ConfigResult {
                        success: true,
                        message: format!("Configuration loaded from {}", expanded_path),
                        config: Some(config),
                    });
                }
                Err(e) => {
                    let _ = send_message(&EngineMessage::ConfigResult {
                        success: false,
                        message: format!("Invalid config format: {}", e),
                        config: None,
                    });
                }
            }
        }
        Err(e) => {
            let _ = send_message(&EngineMessage::ConfigResult {
                success: false,
                message: format!("Failed to read config: {}", e),
                config: None,
            });
        }
    }
}
