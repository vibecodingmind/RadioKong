//! Audio capture module
//!
//! Handles audio input device enumeration and audio stream capture using CPAL.
//! Supports cross-platform audio capture via:
//! - CoreAudio (macOS)
//! - WASAPI (Windows)
//! - ALSA/PulseAudio/JACK/PipeWire (Linux)
//!
//! When compiled without the `audio-capture` feature, provides stub implementations.

#[cfg(feature = "audio-capture")]
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
#[cfg(feature = "audio-capture")]
use cpal::{Device, Host, Stream, StreamConfig, SampleFormat};
#[cfg(feature = "audio-capture")]
use crossbeam_channel::{Receiver, Sender};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::DeviceInfo;

/// Audio capture manager
pub struct AudioCapture {
    #[cfg(feature = "audio-capture")]
    host: Host,
    #[cfg(feature = "audio-capture")]
    stream: Option<Stream>,
    running: Arc<AtomicBool>,
    #[cfg(feature = "audio-capture")]
    sample_sender: Option<Sender<Vec<f32>>>,
}

impl AudioCapture {
    /// Create a new audio capture instance using the default CPAL host
    pub fn new() -> Self {
        Self {
            #[cfg(feature = "audio-capture")]
            host: cpal::default_host(),
            #[cfg(feature = "audio-capture")]
            stream: None,
            running: Arc::new(AtomicBool::new(false)),
            #[cfg(feature = "audio-capture")]
            sample_sender: None,
        }
    }

    /// List all available audio input devices
    #[cfg(feature = "audio-capture")]
    pub fn list_devices(&self) -> Vec<DeviceInfo> {
        let mut devices = Vec::new();

        // Default input device
        if let Ok(default_input) = self.host.default_input_device() {
            if let Ok(config) = default_input.default_input_config() {
                devices.push(DeviceInfo {
                    id: "default".to_string(),
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

        devices
    }

    /// List all available audio input devices (stub - no audio-capture feature)
    #[cfg(not(feature = "audio-capture"))]
    pub fn list_devices(&self) -> Vec<DeviceInfo> {
        vec![
            DeviceInfo {
                id: "default".to_string(),
                name: "Default System Input".to_string(),
                is_input: true,
                is_default: true,
                channels: 2,
                sample_rates: vec![44100, 48000],
            },
        ]
    }

    /// Start capturing audio from the specified device
    #[cfg(feature = "audio-capture")]
    pub fn start_capture(
        &mut self,
        device_id: &str,
        sample_rate: u32,
        channels: u16,
        buffer_size: u32,
    ) -> Result<Receiver<Vec<f32>>, String> {
        self.stop_capture();

        let device = if device_id == "default" || device_id.is_empty() {
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

    /// Start capturing audio (stub - no audio-capture feature)
    #[cfg(not(feature = "audio-capture"))]
    pub fn start_capture(
        &mut self,
        _device_id: &str,
        _sample_rate: u32,
        _channels: u16,
        _buffer_size: u32,
    ) -> Result<(), String> {
        log::warn!("Audio capture not available (compiled without audio-capture feature)");
        Ok(())
    }

    /// Stop the current audio capture
    pub fn stop_capture(&mut self) {
        self.running.store(false, Ordering::SeqCst);
        #[cfg(feature = "audio-capture")]
        {
            self.stream = None;
            self.sample_sender = None;
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
