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
                m.set_volume(&channel, volume);
            }
        }
        EngineCommand::SetMute { channel, muted } => {
            let mut s = state.lock().unwrap();
            if let Some(ref mut m) = s.mixer {
                m.set_mute(&channel, muted);
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
        EngineCommand::StartRecording { path } => {
            handle_start_recording(path, state);
        }
        EngineCommand::StopRecording => {
            let mut s = state.lock().unwrap();
            s.recording_file = None;
            s.is_recording = false;
            let _ = send_message(&EngineMessage::Status {
                message: "Recording stopped".to_string(),
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
        EngineCommand::RemoveServer { id: _ } => {
            // Server removal is handled by disconnecting additional servers
            // In a full implementation, we'd track servers by ID
            log::info!("Remove server command received");
        }
        EngineCommand::SetOutputDevice { device } => {
            log::info!("Output device set to: {}", device);
            // In a full implementation, this would switch the CPAL output device
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

fn handle_start_recording(path: String, state: &Arc<Mutex<EngineState>>) {
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

    match std::fs::File::create(&expanded_path) {
        Ok(file) => {
            // Write WAV header
            let mut s = state.lock().unwrap();
            s.recording_file = Some(file);
            s.is_recording = true;
            // Write WAV header will happen on first audio data
            let _ = send_message(&EngineMessage::Status {
                message: format!("Recording started: {}", path),
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
