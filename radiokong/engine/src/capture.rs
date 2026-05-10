//! Audio capture module
//!
//! Handles audio input device enumeration and audio stream capture using CPAL.
//! Supports cross-platform audio capture via:
//! - CoreAudio (macOS) — no extra dependencies needed!
//! - WASAPI (Windows)
//! - ALSA/PulseAudio/JACK/PipeWire (Linux — requires libasound2-dev)
//!
//! When compiled without the `audio-capture` feature, provides stub implementations
//! that generate silence (for development/testing without audio hardware).

use crossbeam_channel::{Receiver, Sender};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[cfg(feature = "audio-capture")]
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
#[cfg(feature = "audio-capture")]
use cpal::{Device, Host, Stream, StreamConfig, SampleFormat};

use crate::DeviceInfo;

/// Audio capture manager
pub struct AudioCapture {
    #[cfg(feature = "audio-capture")]
    host: Host,
    #[cfg(feature = "audio-capture")]
    stream: Option<Stream>,
    running: Arc<AtomicBool>,
    sample_sender: Option<Sender<Vec<f32>>>,
    #[cfg(not(feature = "audio-capture"))]
    silence_thread: Option<std::thread::JoinHandle<()>>,
}

impl AudioCapture {
    /// Create a new audio capture instance
    pub fn new() -> Self {
        Self {
            #[cfg(feature = "audio-capture")]
            host: cpal::default_host(),
            #[cfg(feature = "audio-capture")]
            stream: None,
            running: Arc::new(AtomicBool::new(false)),
            sample_sender: None,
            #[cfg(not(feature = "audio-capture"))]
            silence_thread: None,
        }
    }

    /// List all available audio input and output devices
    #[cfg(feature = "audio-capture")]
    pub fn list_devices(&self) -> Vec<DeviceInfo> {
        let mut devices = Vec::new();

        // Default input device
        if let Ok(default_input) = self.host.default_input_device() {
            if let Ok(config) = default_input.default_input_config() {
                devices.push(DeviceInfo {
                    id: "default-input".to_string(),
                    name: default_input.name().unwrap_or_else(|_| "Default Input".to_string()),
                    is_input: true,
                    is_default: true,
                    channels: config.channels(),
                    sample_rates: vec![config.sample_rate().0],
                });
            }
        }

        // All input devices
        if let Ok(input_devices) = self.host.input_devices() {
            for (idx, device) in input_devices.enumerate() {
                if let Ok(config) = device.default_input_config() {
                    let name = device.name().unwrap_or_else(|_| format!("Input Device {}", idx));
                    if devices.iter().any(|d| d.name == name) {
                        continue;
                    }
                    devices.push(DeviceInfo {
                        id: format!("input-{}", idx),
                        name,
                        is_input: true,
                        is_default: false,
                        channels: config.channels(),
                        sample_rates: vec![config.sample_rate().0],
                    });
                }
            }
        }

        // Default output device
        if let Ok(default_output) = self.host.default_output_device() {
            if let Ok(config) = default_output.default_output_config() {
                devices.push(DeviceInfo {
                    id: "default-output".to_string(),
                    name: default_output.name().unwrap_or_else(|_| "Default Output".to_string()),
                    is_input: false,
                    is_default: true,
                    channels: config.channels(),
                    sample_rates: vec![config.sample_rate().0],
                });
            }
        }

        // All output devices
        if let Ok(output_devices) = self.host.output_devices() {
            for (idx, device) in output_devices.enumerate() {
                if let Ok(config) = device.default_output_config() {
                    let name = device.name().unwrap_or_else(|_| format!("Output Device {}", idx));
                    if devices.iter().any(|d| d.name == name) {
                        continue;
                    }
                    devices.push(DeviceInfo {
                        id: format!("output-{}", idx),
                        name,
                        is_input: false,
                        is_default: false,
                        channels: config.channels(),
                        sample_rates: vec![config.sample_rate().0],
                    });
                }
            }
        }

        devices
    }

    /// List all available audio input and output devices (stub when no audio-capture feature)
    #[cfg(not(feature = "audio-capture"))]
    pub fn list_devices(&self) -> Vec<DeviceInfo> {
        vec![
            DeviceInfo {
                id: "default-input".to_string(),
                name: "Default System Input (simulated)".to_string(),
                is_input: true,
                is_default: true,
                channels: 2,
                sample_rates: vec![44100, 48000],
            },
            DeviceInfo {
                id: "default-output".to_string(),
                name: "Default System Output (simulated)".to_string(),
                is_input: false,
                is_default: true,
                channels: 2,
                sample_rates: vec![44100, 48000],
            },
        ]
    }

    /// Start capturing audio from the specified device (real audio capture)
    #[cfg(feature = "audio-capture")]
    pub fn start_capture(
        &mut self,
        device_id: &str,
        sample_rate: u32,
        channels: u16,
        buffer_size: u32,
    ) -> Result<Receiver<Vec<f32>>, String> {
        self.stop_capture();

        let device = if device_id == "default" || device_id == "default-input" || device_id.is_empty() {
            self.host.default_input_device()
                .ok_or("No default input device available")?
        } else {
            self.find_device(device_id)
                .ok_or_else(|| format!("Device '{}' not found", device_id))?
        };

        let supported_config = device.default_input_config()
            .map_err(|e| format!("Failed to get device config: {}", e))?;

        let config = StreamConfig {
            channels: cpal::ChannelCount::from(channels),
            sample_rate: cpal::SampleRate(sample_rate),
            buffer_size: cpal::BufferSize::Fixed(buffer_size),
        };

        let (sender, receiver) = crossbeam_channel::bounded(32);
        self.sample_sender = Some(sender);
        self.running.store(true, Ordering::SeqCst);
        let running = self.running.clone();

        let stream = match supported_config.sample_format() {
            SampleFormat::F32 => self.build_stream::<f32>(&device, &config, running)?,
            SampleFormat::I16 => self.build_stream::<i16>(&device, &config, running)?,
            SampleFormat::U16 => self.build_stream::<u16>(&device, &config, running)?,
            _ => return Err("Unsupported sample format".to_string()),
        };

        stream.play()
            .map_err(|e| format!("Failed to start audio stream: {}", e))?;

        self.stream = Some(stream);
        log::info!(
            "Audio capture started: device={}, rate={}Hz, channels={}, buffer={}",
            device.name().unwrap_or_default(),
            sample_rate, channels, buffer_size
        );

        Ok(receiver)
    }

    /// Start capturing audio (silence generator when no audio-capture feature)
    #[cfg(not(feature = "audio-capture"))]
    pub fn start_capture(
        &mut self,
        _device_id: &str,
        sample_rate: u32,
        _channels: u16,
        buffer_size: u32,
    ) -> Result<Receiver<Vec<f32>>, String> {
        self.stop_capture();

        let (sender, receiver) = crossbeam_channel::bounded(32);
        self.sample_sender = Some(sender);
        self.running.store(true, Ordering::SeqCst);

        let running = self.running.clone();
        let samples_per_buffer = (sample_rate as usize * buffer_size as usize) / 1000;
        let sender_for_thread = self.sample_sender.clone();

        // Spawn a thread that generates a test tone at the right rate
        let handle = std::thread::Builder::new()
            .name("audio-test-tone-gen".to_string())
            .spawn(move || {
                let interval = std::time::Duration::from_millis(buffer_size as u64 / 2);
                let mut phase: f32 = 0.0;
                let freq = 440.0; // A4 test tone
                let phase_increment = 2.0 * std::f32::consts::PI * freq / sample_rate as f32;

                while running.load(Ordering::SeqCst) {
                    // Generate a 440Hz sine wave at low volume for testing
                    let mut buffer = Vec::with_capacity(samples_per_buffer * 2);
                    for _ in 0..samples_per_buffer {
                        let sample = (phase.sin() * 0.1).max(-1.0).min(1.0); // -20dB test tone
                        buffer.push(sample); // left
                        buffer.push(sample); // right
                        phase += phase_increment;
                        if phase > 2.0 * std::f32::consts::PI {
                            phase -= 2.0 * std::f32::consts::PI;
                        }
                    }

                    if let Some(ref s) = sender_for_thread {
                        let _ = s.try_send(buffer);
                    }

                    std::thread::sleep(interval);
                }
            })
            .map_err(|e| format!("Failed to spawn audio thread: {}", e))?;

        self.silence_thread = Some(handle);
        log::info!("Audio capture started (simulated, 440Hz test tone at -20dB)");
        Ok(receiver)
    }

    /// Stop the current audio capture
    pub fn stop_capture(&mut self) {
        self.running.store(false, Ordering::SeqCst);
        self.sample_sender = None;

        #[cfg(feature = "audio-capture")]
        {
            self.stream = None;
        }

        #[cfg(not(feature = "audio-capture"))]
        {
            if let Some(handle) = self.silence_thread.take() {
                let _ = handle.join();
            }
        }

        log::info!("Audio capture stopped");
    }

    /// Check if capture is currently running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    #[cfg(feature = "audio-capture")]
    fn find_device(&self, device_id: &str) -> Option<Device> {
        if let Ok(devices) = self.host.input_devices() {
            for (idx, device) in devices.enumerate() {
                let id = format!("input-{}", idx);
                if id == device_id {
                    return Some(device);
                }
                if let Ok(name) = device.name() {
                    if name.contains(device_id) {
                        return Some(device);
                    }
                }
            }
        }
        None
    }

    #[cfg(feature = "audio-capture")]
    fn build_stream<T>(
        &self,
        device: &Device,
        config: &StreamConfig,
        running: Arc<AtomicBool>,
    ) -> Result<Stream, String>
    where
        T: cpal::Sample + dasp::sample::ToSample<f32>,
    {
        let sender = self.sample_sender.clone();
        let channels = config.channels as usize;

        let stream = device.build_input_stream(
            config,
            move |data: &[T], _: &cpal::InputCallbackInfo| {
                if !running.load(Ordering::SeqCst) {
                    return;
                }

                let samples: Vec<f32> = data.iter()
                    .map(|s| s.to_sample())
                    .collect();

                let interleaved = if channels == 1 {
                    samples.iter().flat_map(|&s| [s, s]).collect()
                } else if channels == 2 {
                    samples
                } else {
                    samples.chunks(channels)
                        .flat_map(|chunk| {
                            let left = chunk.first().copied().unwrap_or(0.0);
                            let right = chunk.get(1).copied().unwrap_or(left);
                            [left, right]
                        })
                        .collect()
                };

                if let Some(ref sender) = sender {
                    let _ = sender.try_send(interleaved);
                }
            },
            |err| {
                log::error!("Audio capture error: {}", err);
            },
            None,
        ).map_err(|e| format!("Failed to build audio stream: {}", e))?;

        Ok(stream)
    }
}

impl Drop for AudioCapture {
    fn drop(&mut self) {
        self.stop_capture();
    }
}
