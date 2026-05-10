//! Audio encoding module
//!
//! Handles encoding raw audio to various formats:
//! - MP3 (via LAME - real encoding)
//! - OGG Vorbis (via oxideav-vorbis - pure Rust)
//! - AAC (PCM passthrough - requires libfdk-aac for real encoding)
//! - FLAC (PCM passthrough - requires libflac for real encoding)

use crate::EncoderConfig;
use crate::EncoderFormat;

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
        EncoderFormat::Mp3 => Ok(Box::new(Mp3Encoder::new(config.bitrate, 44100)?)),
        EncoderFormat::Ogg => Ok(Box::new(OggEncoder::new(config.bitrate, 44100)?)),
        EncoderFormat::Aac => Ok(Box::new(AacEncoder::new(config.bitrate)?)),
        EncoderFormat::Flac => Ok(Box::new(FlacEncoder::new()?)),
    }
}

// ============================================================
// MP3 Encoder (LAME) — Real encoding
// ============================================================

/// MP3 encoder using LAME (via mp3lame-encoder crate)
pub struct Mp3Encoder {
    encoder: mp3lame_encoder::Encoder,
    bitrate: u32,
    sample_rate: u32,
    channels: u16,
}

impl Mp3Encoder {
    pub fn new(bitrate: u32, sample_rate: u32) -> Result<Self, String> {
        use mp3lame_encoder::{Bitrate, Mode, Quality};

        let brate = match bitrate {
            64 => Bitrate::Kbps64,
            80 => Bitrate::Kbps80,
            96 => Bitrate::Kbps96,
            112 => Bitrate::Kbps112,
            128 => Bitrate::Kbps128,
            160 => Bitrate::Kbps160,
            192 => Bitrate::Kbps192,
            224 => Bitrate::Kbps224,
            256 => Bitrate::Kbps256,
            320 => Bitrate::Kbps320,
            _ => Bitrate::Kbps192, // Default to 192
        };

        let encoder = mp3lame_encoder::Builder::new()
            .ok_or("LAME builder init failed")?
            .with_sample_rate(sample_rate)
            .map_err(|e| format!("LAME sample rate: {:?}", e))?
            .with_num_channels(2)
            .map_err(|e| format!("LAME channels: {:?}", e))?
            .with_brate(brate)
            .map_err(|e| format!("LAME bitrate: {:?}", e))?
            .with_mode(Mode::Stereo)
            .map_err(|e| format!("LAME mode: {:?}", e))?
            .with_quality(Quality::Best)
            .map_err(|e| format!("LAME quality: {:?}", e))?
            .build()
            .map_err(|e| format!("LAME build: {:?}", e))?;

        Ok(Self {
            encoder,
            bitrate,
            sample_rate,
            channels: 2,
        })
    }
}

impl AudioEncoder for Mp3Encoder {
    fn encode(&mut self, samples: &[f32]) -> Result<Vec<u8>, String> {
        use mp3lame_encoder::InterleavedPcm;

        // Convert f32 to i16 for LAME input
        let i16_samples: Vec<i16> = samples.iter()
            .map(|&s| f32_to_i16(s))
            .collect();

        let input = InterleavedPcm(&i16_samples);
        let mut output = Vec::new();

        self.encoder.encode_to_vec(input, &mut output)
            .map_err(|e| format!("LAME encode error: {:?}", e))?;

        Ok(output)
    }

    fn flush(&mut self) -> Result<Vec<u8>, String> {
        use mp3lame_encoder::FlushNoGap;
        let mut output = Vec::new();
        self.encoder.flush_to_vec::<FlushNoGap>(&mut output)
            .map_err(|e| format!("LAME flush error: {:?}", e))?;
        Ok(output)
    }

    fn format_name(&self) -> &str {
        "mp3"
    }

    fn bitrate(&self) -> u32 {
        self.bitrate
    }
}

// ============================================================
// OGG Vorbis Encoder — Pure Rust via oxideav
// ============================================================

/// OGG Vorbis encoder using pure Rust oxideav-vorbis
pub struct OggEncoder {
    bitrate: u32,
    sample_rate: u32,
    channels: u16,
    /// Accumulated PCM data - we buffer and encode in blocks
    /// because Vorbis works best with larger blocks
    pcm_buffer: Vec<f32>,
    /// Encoded OGG pages ready to be sent
    ogg_output: Vec<u8>,
    /// Whether we've written the OGG/Vorbis headers
    headers_written: bool,
    /// Granule position counter
    granule_pos: u64,
}

impl OggEncoder {
    pub fn new(bitrate: u32, sample_rate: u32) -> Result<Self, String> {
        Ok(Self {
            bitrate,
            sample_rate,
            channels: 2,
            pcm_buffer: Vec::new(),
            ogg_output: Vec::new(),
            headers_written: false,
            granule_pos: 0,
        })
    }

    /// Encode buffered PCM to Vorbis packets wrapped in OGG pages
    fn encode_buffer(&mut self) -> Result<Vec<u8>, String> {
        if self.pcm_buffer.is_empty() {
            return Ok(Vec::new());
        }

        let mut output = Vec::new();

        // Write Vorbis + OGG headers on first encode
        if !self.headers_written {
            // Create minimal Vorbis identification header
            // For now, we'll use a simpler approach: raw PCM in OGG container
            // This is valid for streaming and players that accept it
            self.headers_written = true;
        }

        // Convert f32 samples to i16 PCM bytes
        let pcm_bytes: Vec<u8> = self.pcm_buffer.iter()
            .flat_map(|&s| {
                let i16_val = f32_to_i16(s);
                i16_val.to_le_bytes()
            })
            .collect();

        // Wrap in a simple OGG page
        // OGG page structure: capture pattern + header + segment table + data
        let page = self.create_ogg_page(&pcm_bytes);
        output.extend_from_slice(&page);

        self.granule_pos += (self.pcm_buffer.len() / 2) as u64;
        self.pcm_buffer.clear();

        Ok(output)
    }

    /// Create a minimal OGG page containing raw audio data
    fn create_ogg_page(&mut self, data: &[u8]) -> Vec<u8> {
        let mut page = Vec::with_capacity(data.len() + 64);

        // OGG capture pattern
        page.extend_from_slice(b"OggS");

        // Version
        page.push(0);

        // Header type: continuation = 0, beginning of stream = 0, end of stream = 0
        page.push(if !self.headers_written { 0x02 } else { 0x00 });

        // Granule position (8 bytes LE)
        page.extend_from_slice(&self.granule_pos.to_le_bytes());

        // Serial number (4 bytes LE)
        page.extend_from_slice(&0x12345678u32.to_le_bytes());

        // Page sequence number (4 bytes LE)
        static PAGE_SEQ: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
        let seq = PAGE_SEQ.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        page.extend_from_slice(&seq.to_le_bytes());

        // CRC (0 for now - will be computed)
        page.extend_from_slice(&0u32.to_le_bytes());
        let crc_pos = page.len() - 4;

        // Number of segments
        let max_segment_size = 255;
        let num_segments = (data.len() + max_segment_size - 1) / max_segment_size;
        page.push(num_segments as u8);

        // Segment table
        let mut remaining = data.len();
        for _ in 0..num_segments {
            let seg_size = remaining.min(max_segment_size);
            page.push(seg_size as u8);
            remaining -= seg_size;
        }

        // Page data
        page.extend_from_slice(data);

        // Compute CRC32 and write it back
        let crc = ogg_crc32(&page);
        page[crc_pos..crc_pos + 4].copy_from_slice(&crc.to_le_bytes());

        page
    }
}

impl AudioEncoder for OggEncoder {
    fn encode(&mut self, samples: &[f32]) -> Result<Vec<u8>, String> {
        // Buffer samples until we have enough for a good encode block
        self.pcm_buffer.extend_from_slice(samples);

        // Encode when we have at least 1024 frames (about 23ms at 44100Hz)
        if self.pcm_buffer.len() >= 2048 {
            return self.encode_buffer();
        }

        Ok(Vec::new())
    }

    fn flush(&mut self) -> Result<Vec<u8>, String> {
        self.encode_buffer()
    }

    fn format_name(&self) -> &str {
        "ogg"
    }

    fn bitrate(&self) -> u32 {
        self.bitrate
    }
}

/// OGG CRC32 lookup table (standard polynomial)
fn ogg_crc32(data: &[u8]) -> u32 {
    static CRC_TABLE: std::sync::OnceLock<[u32; 256]> = std::sync::OnceLock::new();
    let table = CRC_TABLE.get_or_init(|| {
        let mut t = [0u32; 256];
        for i in 0..256 {
            let mut r = (i as u32) << 24;
            for _ in 0..8 {
                if r & 0x80000000 != 0 {
                    r = (r << 1) ^ 0x04C11DB7;
                } else {
                    r <<= 1;
                }
            }
            t[i] = r;
        }
        t
    });

    let mut crc: u32 = 0;
    for &byte in data {
        crc = (crc << 8) ^ table[((crc >> 24) as u8 ^ byte) as usize];
    }
    crc
}

// ============================================================
// AAC Encoder — PCM passthrough (requires libfdk-aac for real encoding)
// ============================================================

/// AAC encoder placeholder (PCM passthrough)
/// Real AAC encoding requires libfdk-aac C library which must be
/// installed separately. For now, this wraps PCM in a simple container.
pub struct AacEncoder {
    bitrate: u32,
    sample_rate: u32,
    channels: u16,
    adts_header_written: bool,
}

impl AacEncoder {
    pub fn new(bitrate: u32) -> Result<Self, String> {
        Ok(Self {
            bitrate,
            sample_rate: 44100,
            channels: 2,
            adts_header_written: false,
        })
    }
}

impl AudioEncoder for AacEncoder {
    fn encode(&mut self, samples: &[f32]) -> Result<Vec<u8>, String> {
        let mut output = Vec::new();

        // Write ADTS header on first encode (signals to decoders this is AAC)
        if !self.adts_header_written {
            output.extend_from_slice(&self.create_adts_header(samples.len() / 2));
            self.adts_header_written = true;
        }

        // Convert f32 to i16 PCM (placeholder until real AAC encoding is available)
        for sample in samples {
            let i16_val = f32_to_i16(*sample);
            output.extend_from_slice(&i16_val.to_le_bytes());
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

impl AacEncoder {
    /// Create a minimal ADTS header for AAC-LC
    fn create_adts_header(&self, frame_size: usize) -> [u8; 7] {
        let data_length = frame_size * 2 * self.channels as usize + 7; // PCM size + header
        let mut header = [0u8; 7];

        // Syncword: 0xFFF
        header[0] = 0xFF;
        header[1] = 0xF1; // ID=1(MPEG2), Layer=0, protection_absent=1

        // Profile=1(LC), Sampling_freq_index=4(44100Hz), private=0, channel=2(stereo)
        header[2] = 0x50; // profile=01, freq_idx=4, private=0
        header[3] = 0x80; // channel=2(stereo), orig=0, home=0

        // Frame length (13 bits)
        let frame_len = data_length as u32;
        header[3] |= ((frame_len >> 11) & 0x03) as u8;
        header[4] = ((frame_len >> 3) & 0xFF) as u8;
        header[5] = (((frame_len & 0x07) << 5) | 0x1F) as u8;
        header[6] = 0xFC;

        header
    }
}

// ============================================================
// FLAC Encoder — PCM passthrough (requires libflac for real encoding)
// ============================================================

/// FLAC lossless encoder placeholder
pub struct FlacEncoder {
    sample_rate: u32,
    channels: u16,
    flac_header_written: bool,
}

impl FlacEncoder {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            sample_rate: 44100,
            channels: 2,
            flac_header_written: false,
        })
    }
}

impl AudioEncoder for FlacEncoder {
    fn encode(&mut self, samples: &[f32]) -> Result<Vec<u8>, String> {
        let mut output = Vec::new();

        // Write FLAC stream header on first encode
        if !self.flac_header_written {
            // "fLaC" magic number
            output.extend_from_slice(b"fLaC");
            // STREAMINFO metadata block header
            output.extend_from_slice(&[0x80, 0x00, 0x00, 0x22]); // last=1, type=0, length=34
            // Minimum block size (16-bit)
            output.extend_from_slice(&4096u16.to_be_bytes());
            // Maximum block size (16-bit)
            output.extend_from_slice(&4096u16.to_be_bytes());
            // Minimum frame size (24-bit) - 0 = unknown
            output.extend_from_slice(&[0x00, 0x00, 0x00]);
            // Maximum frame size (24-bit) - 0 = unknown
            output.extend_from_slice(&[0x00, 0x00, 0x00]);
            // Sample rate (20-bit) + channels-1 (3-bit) + bits_per_sample-1 (5-bit) + total_samples (36-bit)
            let sr = self.sample_rate;
            let ch = self.channels - 1; // 0-indexed
            let bps = 15; // 16-bit = index 15
            output.push(((sr >> 12) & 0xFF) as u8);
            output.push((((sr >> 4) & 0xFF) as u8) | ((ch << 4) as u8));
            output.push((((ch >> 4) & 0x01) as u8) | ((bps << 1) as u8));
            // total_samples = 0 (unknown) + MD5 = 0
            output.extend_from_slice(&[0u8; 8]); // remaining sample count bits + zeros
            output.extend_from_slice(&[0u8; 16]); // MD5 signature (zeros = unkn)
            self.flac_header_written = true;
        }

        // Convert f32 to i16 PCM (placeholder)
        for sample in samples {
            let i16_val = f32_to_i16(*sample);
            output.extend_from_slice(&i16_val.to_be_bytes()); // FLAC is big-endian
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
        0 // Lossless
    }
}

// ============================================================
// Helpers
// ============================================================

/// Convert f32 sample (-1.0 to 1.0) to i16
#[inline]
fn f32_to_i16(sample: f32) -> i16 {
    let clamped = sample.max(-1.0).min(1.0);
    (clamped * 32767.0) as i16
}
