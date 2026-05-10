//! RadioKong Audio Engine - Main Entry Point
//!
//! This binary runs as a sidecar process alongside the Electron app.
//! Communication is done via stdin/stdout using JSON messages.
//!
//! Protocol:
//! - Receive commands on stdin (one JSON object per line)
//! - Send status messages on stdout (one JSON object per line)
//! - Log output on stderr

use std::io::{self, BufRead, Write};

use radiokong_engine::*;
use capture::AudioCapture;
use encoder::{self, AudioEncoder};
use streamer::StreamClient;
use mixer::Mixer;
use dsp::DSPPipeline;

fn main() {
    // Initialize logger (output to stderr to avoid interfering with JSON communication)
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .target(env_logger::Target::Stderr)
        .init();

    log::info!("RadioKong Audio Engine starting...");

    // Engine state
    let mut capture = AudioCapture::new();
    let mut encoder: Option<Box<dyn AudioEncoder>> = None;
    let mut streamer: Option<StreamClient> = None;
    let mut mixer: Option<Mixer> = None;
    let mut dsp_pipeline: Option<DSPPipeline> = None;
    let mut is_streaming = false;
    let mut is_recording = false;
    let mut recording_file: Option<std::fs::File> = None;

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

                // Parse the command
                let command: Result<EngineCommand, _> = serde_json::from_str(&line_str);

                match command {
                    Ok(cmd) => {
                        log::info!("Received command: {:?}", cmd);

                        match cmd {
                            EngineCommand::Start { config } => {
                                match start_streaming(&config, &mut capture, &mut encoder, &mut streamer, &mut mixer, &mut dsp_pipeline) {
                                    Ok(()) => {
                                        is_streaming = true;
                                        let _ = send_message(&EngineMessage::Status {
                                            message: "Streaming started".to_string(),
                                        });
                                        let _ = send_message(&EngineMessage::StreamStatus {
                                            connected: true,
                                            bytes_sent: 0,
                                            uptime: 0,
                                            bitrate: config.encoder.bitrate,
                                            format: config.encoder.format.to_string(),
                                            server: format!("{}:{}", config.server.host, config.server.port),
                                            mount: config.server.mount,
                                        });
                                    }
                                    Err(e) => {
                                        log::error!("Failed to start streaming: {}", e);
                                        let _ = send_message(&EngineMessage::Error {
                                            message: format!("Failed to start: {}", e),
                                            code: Some("START_FAILED".to_string()),
                                        });
                                    }
                                }
                            }

                            EngineCommand::Stop => {
                                stop_streaming(&mut capture, &mut streamer);
                                is_streaming = false;
                                if is_recording {
                                    stop_recording(&mut recording_file);
                                    is_recording = false;
                                }
                                let _ = send_message(&EngineMessage::StreamStatus {
                                    connected: false,
                                    bytes_sent: streamer.as_ref().map(|s| s.bytes_sent()).unwrap_or(0),
                                    uptime: streamer.as_ref().map(|s| s.uptime()).unwrap_or(0),
                                    bitrate: 0,
                                    format: "".to_string(),
                                    server: "".to_string(),
                                    mount: "".to_string(),
                                });
                            }

                            EngineCommand::SetVolume { channel, volume } => {
                                if let Some(ref mut m) = mixer {
                                    m.set_volume(&channel, volume);
                                }
                            }

                            EngineCommand::SetMute { channel, muted } => {
                                if let Some(ref mut m) = mixer {
                                    m.set_mute(&channel, muted);
                                }
                            }

                            EngineCommand::SetSolo { channel, solo } => {
                                if let Some(ref mut m) = mixer {
                                    m.set_solo(&channel, solo);
                                }
                            }

                            EngineCommand::SetMetadata { title, artist } => {
                                if let Some(ref mut s) = streamer {
                                    if let Err(e) = s.update_metadata(&title, &artist) {
                                        log::error!("Metadata update failed: {}", e);
                                    }
                                }
                            }

                            EngineCommand::StartRecording { path } => {
                                match start_recording(&path) {
                                    Ok(file) => {
                                        recording_file = Some(file);
                                        is_recording = true;
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

                            EngineCommand::StopRecording => {
                                stop_recording(&mut recording_file);
                                is_recording = false;
                                let _ = send_message(&EngineMessage::Status {
                                    message: "Recording stopped".to_string(),
                                });
                            }

                            EngineCommand::ListDevices => {
                                let devices = capture.list_devices();
                                let _ = send_message(&EngineMessage::Devices { list: devices });
                            }
                        }
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
    if is_streaming {
        stop_streaming(&mut capture, &mut streamer);
    }
    log::info!("RadioKong Audio Engine shutting down");
}

fn start_streaming(
    config: &EngineConfig,
    capture: &mut AudioCapture,
    encoder: &mut Option<Box<dyn AudioEncoder>>,
    streamer: &mut Option<StreamClient>,
    mixer: &mut Option<Mixer>,
    dsp_pipeline: &mut Option<DSPPipeline>,
) -> Result<(), String> {
    // Initialize encoder
    *encoder = Some(encoder::create_encoder(&config.encoder)?);

    // Initialize mixer
    *mixer = Some(Mixer::new(config.mixer.channels.clone(), config.audio.sample_rate));

    // Initialize DSP pipeline
    *dsp_pipeline = Some(DSPPipeline::new(config.audio.sample_rate));

    // Initialize streamer
    let client = StreamClient::new(config.server.clone());
    *streamer = Some(client);

    // Start audio capture
    capture.start_capture(
        &config.audio.device,
        config.audio.sample_rate,
        config.audio.channels,
        config.audio.buffer_size,
    )?;

    log::info!("Audio pipeline initialized successfully");
    Ok(())
}

fn stop_streaming(capture: &mut AudioCapture, streamer: &mut Option<StreamClient>) {
    capture.stop_capture();
    if let Some(ref mut s) = streamer {
        s.disconnect();
    }
    *streamer = None;
    log::info!("Streaming stopped");
}

fn start_recording(path: &str) -> Result<std::fs::File, String> {
    let expanded_path = if path.starts_with("~/") {
        if let Ok(home) = std::env::var("HOME") {
            format!("{}{}", home, &path[1..])
        } else {
            path.to_string()
        }
    } else {
        path.to_string()
    };

    if let Some(parent) = std::path::Path::new(&expanded_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let file = std::fs::File::create(&expanded_path)
        .map_err(|e| format!("Failed to create recording file: {}", e))?;

    log::info!("Recording started: {}", expanded_path);
    Ok(file)
}

fn stop_recording(recording_file: &mut Option<std::fs::File>) {
    *recording_file = None;
}

fn send_message(message: &EngineMessage) -> io::Result<()> {
    let json = serde_json::to_string(message)?;
    println!("{}", json);
    io::stdout().flush()?;
    Ok(())
}
