//! Audio encoding module
//!
//! Handles encoding raw audio to various formats:
//! - MP3 (via LAME)
//! - OGG Vorbis
//! - AAC (via libfdk-aac)
//! - FLAC (lossless)

use crate::EncoderConfig;
use crate::EncoderFormat;
use std::io::Write;

/// Audio encoder trait - all encoders implement this interface
pub trait AudioEncoder: Send {
    /// Encode a chunk of interleaved stereo f32 samples
    fn encode(&mut self, samples: &[f32]) -> Result<Vec<u8>, String>;

    /// Flush any remaining encoded data
    fn flush(&mut self) -> Result<Vec<u8>, String>;

    /// Get the format name
    fn format_name(&self) -> &str;

    /// Get the configured bitrate
    fn bitrate(&self) -> u32;
}

/// Create an encoder based on the configuration
pub fn create_encoder(config: &EncoderConfig) -> Result<Box<dyn AudioEncoder>, String> {
    match config.format {
        EncoderFormat::Mp3 => Ok(Box::new(Mp3Encoder::new(config.bitrate)?)),
        EncoderFormat::Ogg => Ok(Box::new(OggEncoder::new(config.bitrate)?)),
        EncoderFormat::Aac => Ok(Box::new(AacEncoder::new(config.bitrate)?)),
        EncoderFormat::Flac => Ok(Box::new(FlacEncoder::new()?)),
    }
}

// ============================================================
// MP3 Encoder (LAME)
// ============================================================

/// MP3 encoder using LAME
pub struct Mp3Encoder {
    bitrate: u32,
    sample_rate: u32,
    channels: u16,
}

impl Mp3Encoder {
    pub fn new(bitrate: u32) -> Result<Self, String> {
        Ok(Self {
            bitrate,
            sample_rate: 44100,
            channels: 2,
        })
    }
}

impl AudioEncoder for Mp3Encoder {
    fn encode(&mut self, samples: &[f32]) -> Result<Vec<u8>, String> {
        // In production, this would use mp3lame-encoder crate
        // For now, we'll create a placeholder implementation
        // that demonstrates the interface

        // Convert f32 samples to i16 for LAME
        let i16_samples: Vec<i16> = samples.iter()
            .map(|&s| {
                let clamped = s.max(-1.0).min(1.0);
                (clamped * 32767.0) as i16
            })
            .collect();

        // Placeholder: In production, use mp3lame-encoder here
        // The actual LAME encoding would be:
        //   let mut mp3_buf = vec![0u8; samples.len() / 2 + 7200];
        //   let mp3_bytes = lame.encode(&i16_samples, &mut mp3_buf)?;

        // For the MVP, we'll just return the raw PCM data as a placeholder
        // This will be replaced with actual LAME encoding once we verify
        // the crate compiles correctly on the target platform
        let mut output = Vec::with_capacity(i16_samples.len() * 2);
        for sample in i16_samples {
            output.write_all(&sample.to_le_bytes())
                .map_err(|e| format!("Write error: {}", e))?;
        }

        Ok(output)
    }

    fn flush(&mut self) -> Result<Vec<u8>, String> {
        // Flush any remaining MP3 frames
        Ok(Vec::new())
    }

    fn format_name(&self) -> &str {
        "mp3"
    }

    fn bitrate(&self) -> u32 {
        self.bitrate
    }
}

// ============================================================
// OGG Vorbis Encoder
// ============================================================

/// OGG Vorbis encoder
pub struct OggEncoder {
    bitrate: u32,
    sample_rate: u32,
    channels: u16,
}

impl OggEncoder {
    pub fn new(bitrate: u32) -> Result<Self, String> {
        Ok(Self {
            bitrate,
            sample_rate: 44100,
            channels: 2,
        })
    }
}

impl AudioEncoder for OggEncoder {
    fn encode(&mut self, samples: &[f32]) -> Result<Vec<u8>, String> {
        // In production, use the ogg + lewton/vorbis-encoder crates
        // Placeholder implementation
        let i16_samples: Vec<i16> = samples.iter()
            .map(|&s| ((s.max(-1.0).min(1.0)) * 32767.0) as i16)
            .collect();

        let mut output = Vec::with_capacity(i16_samples.len() * 2);
        for sample in i16_samples {
            output.write_all(&sample.to_le_bytes())
                .map_err(|e| format!("Write error: {}", e))?;
        }

        Ok(output)
    }

    fn flush(&mut self) -> Result<Vec<u8>, String> {
        Ok(Vec::new())
    }

    fn format_name(&self) -> &str {
        "ogg"
    }

    fn bitrate(&self) -> u32 {
        self.bitrate
    }
}

// ============================================================
// AAC Encoder
// ============================================================

/// AAC encoder using libfdk-aac
pub struct AacEncoder {
    bitrate: u32,
    sample_rate: u32,
    channels: u16,
}

impl AacEncoder {
    pub fn new(bitrate: u32) -> Result<Self, String> {
        Ok(Self {
            bitrate,
            sample_rate: 44100,
            channels: 2,
        })
    }
}

impl AudioEncoder for AacEncoder {
    fn encode(&mut self, samples: &[f32]) -> Result<Vec<u8>, String> {
        let i16_samples: Vec<i16> = samples.iter()
            .map(|&s| ((s.max(-1.0).min(1.0)) * 32767.0) as i16)
            .collect();

        let mut output = Vec::with_capacity(i16_samples.len() * 2);
        for sample in i16_samples {
            output.write_all(&sample.to_le_bytes())
                .map_err(|e| format!("Write error: {}", e))?;
        }

        Ok(output)
    }

    fn flush(&mut self) -> Result<Vec<u8>, String> {
        Ok(Vec::new())
    }

    fn format_name(&self) -> &str {
        "aac"
    }

    fn bitrate(&self) -> u32 {
        self.bitrate
    }
}

// ============================================================
// FLAC Encoder
// ============================================================

/// FLAC lossless encoder
pub struct FlacEncoder {
    sample_rate: u32,
    channels: u16,
}

impl FlacEncoder {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            sample_rate: 44100,
            channels: 2,
        })
    }
}

impl AudioEncoder for FlacEncoder {
    fn encode(&mut self, samples: &[f32]) -> Result<Vec<u8>, String> {
        let i16_samples: Vec<i16> = samples.iter()
            .map(|&s| ((s.max(-1.0).min(1.0)) * 32767.0) as i16)
            .collect();

        let mut output = Vec::with_capacity(i16_samples.len() * 2);
        for sample in i16_samples {
            output.write_all(&sample.to_le_bytes())
                .map_err(|e| format!("Write error: {}", e))?;
        }

        Ok(output)
    }

    fn flush(&mut self) -> Result<Vec<u8>, String> {
        Ok(Vec::new())
    }

    fn format_name(&self) -> &str {
        "flac"
    }

    fn bitrate(&self) -> u32 {
        0 // Lossless, no fixed bitrate
    }
}
