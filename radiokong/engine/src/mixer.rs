//! Software mixer module
//!
//! Handles mixing multiple audio channels with volume, mute, solo, and pan controls.
//! Supports 2-8 channels with real-time DSP processing.

use crate::MixerChannelConfig;

/// Mixer channel state (runtime)
#[derive(Debug, Clone)]
pub struct MixerChannel {
    pub id: String,
    pub name: String,
    pub volume: f32,  // 0.0 - 1.0
    pub muted: bool,
    pub solo: bool,
    pub pan: f32,     // -1.0 (left) to 1.0 (right), 0.0 = center
    pub device: Option<String>,
    /// Current VU level
    pub vu_level: (f32, f32), // (left, right)
    /// Peak VU level (slowly decays)
    pub vu_peak: (f32, f32),  // (left, right)
}

impl From<MixerChannelConfig> for MixerChannel {
    fn from(config: MixerChannelConfig) -> Self {
        Self {
            id: config.id,
            name: config.name,
            volume: config.volume,
            muted: config.muted,
            solo: config.solo,
            pan: config.pan,
            device: config.device,
            vu_level: (0.0, 0.0),
            vu_peak: (0.0, 0.0),
        }
    }
}

/// Software mixer
pub struct Mixer {
    channels: Vec<MixerChannel>,
    master_volume: f32,
    master_muted: bool,
    sample_rate: u32,
}

impl Mixer {
    /// Create a new mixer with the given channel configuration
    pub fn new(channels: Vec<MixerChannelConfig>, sample_rate: u32) -> Self {
        Self {
            channels: channels.into_iter().map(MixerChannel::from).collect(),
            master_volume: 0.8,
            master_muted: false,
            sample_rate,
        }
    }

    /// Mix all channel buffers into a single stereo output
    pub fn mix(&mut self, channel_buffers: &[(String, Vec<f32>)]) -> Vec<f32> {
        let frame_count = channel_buffers.first()
            .map(|(_, buf)| buf.len() / 2)
            .unwrap_or(0);

        if frame_count == 0 {
            return Vec::new();
        }

        // Check if any channel has solo enabled
        let any_solo = self.channels.iter().any(|ch| ch.solo);

        // Initialize output buffer
        let mut output = vec![0.0f32; frame_count * 2];

        // Process each channel
        for (channel_id, buffer) in channel_buffers {
            let channel = match self.channels.iter_mut().find(|ch| ch.id == *channel_id) {
                Some(ch) => ch,
                None => continue,
            };

            // Skip muted channels
            if channel.muted {
                channel.vu_level = (0.0, 0.0);
                continue;
            }

            // If any channel has solo, skip non-solo channels
            if any_solo && !channel.solo {
                channel.vu_level = (0.0, 0.0);
                continue;
            }

            // Calculate pan gains
            let (gain_left, gain_right) = calculate_pan_gains(channel.pan);
            let volume = channel.volume;

            // Mix into output buffer
            let mut max_left = 0.0f32;
            let mut max_right = 0.0f32;

            for (i, frame) in buffer.chunks(2).enumerate() {
                let left = frame.first().copied().unwrap_or(0.0) * volume * gain_left;
                let right = frame.get(1).copied().unwrap_or(left) * volume * gain_right;

                if i * 2 + 1 < output.len() {
                    output[i * 2] += left;
                    output[i * 2 + 1] += right;
                }

                // Calculate RMS for VU meter
                max_left = max_left.max(left.abs());
                max_right = max_right.max(right.abs());
            }

            // Update VU levels with smoothing
            let smooth = 0.8;
            channel.vu_level = (
                channel.vu_level.0 * smooth + max_left * (1.0 - smooth),
                channel.vu_level.1 * smooth + max_right * (1.0 - smooth),
            );

            // Update peak (slow decay)
            let peak_decay = 0.995;
            channel.vu_peak = (
                channel.vu_peak.0 * peak_decay + max_left * (1.0 - peak_decay),
                channel.vu_peak.1 * peak_decay + max_right * (1.0 - peak_decay),
            );
            if max_left > channel.vu_peak.0 {
                channel.vu_peak.0 = max_left;
            }
            if max_right > channel.vu_peak.1 {
                channel.vu_peak.1 = max_right;
            }
        }

        // Apply master volume
        if !self.master_muted {
            for sample in output.iter_mut() {
                *sample *= self.master_volume;
            }
        } else {
            output.fill(0.0);
        }

        // Soft clipping to prevent distortion
        for sample in output.iter_mut() {
            *sample = soft_clip(*sample);
        }

        output
    }

    /// Set channel volume
    pub fn set_volume(&mut self, channel_id: &str, volume: f32) {
        if let Some(ch) = self.channels.iter_mut().find(|ch| ch.id == channel_id) {
            ch.volume = volume.clamp(0.0, 1.0);
        }
    }

    /// Set channel mute
    pub fn set_mute(&mut self, channel_id: &str, muted: bool) {
        if let Some(ch) = self.channels.iter_mut().find(|ch| ch.id == channel_id) {
            ch.muted = muted;
        }
    }

    /// Set channel solo
    pub fn set_solo(&mut self, channel_id: &str, solo: bool) {
        if let Some(ch) = self.channels.iter_mut().find(|ch| ch.id == channel_id) {
            ch.solo = solo;
        }
    }

    /// Set master volume
    pub fn set_master_volume(&mut self, volume: f32) {
        self.master_volume = volume.clamp(0.0, 1.0);
    }

    /// Set master mute
    pub fn set_master_mute(&mut self, muted: bool) {
        self.master_muted = muted;
    }

    /// Get VU meter data for all channels
    pub fn get_vu_data(&self) -> Vec<(f32, f32, f32, f32)> {
        self.channels.iter()
            .map(|ch| (ch.vu_level.0, ch.vu_level.1, ch.vu_peak.0, ch.vu_peak.1))
            .collect()
    }

    /// Set channel pan (-1.0 to 1.0)
    pub fn set_pan(&mut self, channel_id: &str, pan: f32) {
        if let Some(ch) = self.channels.iter_mut().find(|ch| ch.id == channel_id) {
            ch.pan = pan.clamp(-1.0, 1.0);
        }
    }

    /// Set channel input device
    pub fn set_device(&mut self, channel_id: &str, device: &str) {
        if let Some(ch) = self.channels.iter_mut().find(|ch| ch.id == channel_id) {
            ch.device = Some(device.to_string());
        }
    }

    /// Add a new channel to the mixer
    pub fn add_channel(&mut self, id: String, name: String, volume: f32, pan: f32) {
        self.channels.push(MixerChannel {
            id,
            name,
            volume: volume.clamp(0.0, 1.0),
            muted: false,
            solo: false,
            pan: pan.clamp(-1.0, 1.0),
            device: None,
            vu_level: (0.0, 0.0),
            vu_peak: (0.0, 0.0),
        });
    }

    /// Remove a channel from the mixer by ID
    pub fn remove_channel(&mut self, channel_id: &str) {
        self.channels.retain(|ch| ch.id != channel_id);
    }
}

/// Calculate left/right gain values based on pan position
/// pan: -1.0 = full left, 0.0 = center, 1.0 = full right
fn calculate_pan_gains(pan: f32) -> (f32, f32) {
    let pan = pan.clamp(-1.0, 1.0);
    // Equal-power panning law
    let angle = (pan + 1.0) * std::f32::consts::FRAC_PI_4;
    let gain_left = angle.cos();
    let gain_right = angle.sin();
    (gain_left, gain_right)
}

/// Soft clipping function (tanh approximation)
fn soft_clip(x: f32) -> f32 {
    if x > 1.0 {
        1.0
    } else if x < -1.0 {
        -1.0
    } else {
        // Simple cubic soft clipper
        let x3 = x * x * x;
        x - 0.333 * x3
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pan_center() {
        let (left, right) = calculate_pan_gains(0.0);
        assert!((left - right).abs() < 0.01);
        assert!(left > 0.69 && left < 0.71);
    }

    #[test]
    fn test_pan_full_left() {
        let (left, right) = calculate_pan_gains(-1.0);
        assert!(left > 0.99);
        assert!(right < 0.01);
    }

    #[test]
    fn test_pan_full_right() {
        let (left, right) = calculate_pan_gains(1.0);
        assert!(left < 0.01);
        assert!(right > 0.99);
    }

    #[test]
    fn test_soft_clip() {
        assert_eq!(soft_clip(0.5), 0.5 - 0.333 * 0.125);
        assert_eq!(soft_clip(2.0), 1.0);
        assert_eq!(soft_clip(-2.0), -1.0);
    }
}
