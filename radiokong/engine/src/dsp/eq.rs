//! Parametric Equalizer
//!
//! 5-band parametric EQ with adjustable frequency, gain, and Q for each band.
//! Uses biquad filter implementation for efficient real-time processing.

/// A single EQ band
#[derive(Debug, Clone)]
pub struct EQBand {
    pub frequency: f32,
    pub gain_db: f32,
    pub q: f32,
    // Biquad filter coefficients
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    // Filter state
    x1: [f32; 2], // previous input (left, right)
    x2: [f32; 2],
    y1: [f32; 2], // previous output (left, right)
    y2: [f32; 2],
}

impl EQBand {
    pub fn new(frequency: f32, gain_db: f32, q: f32, sample_rate: f32) -> Self {
        let mut band = Self {
            frequency,
            gain_db,
            q,
            b0: 0.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
            x1: [0.0; 2],
            x2: [0.0; 2],
            y1: [0.0; 2],
            y2: [0.0; 2],
        };
        band.update_coefficients(sample_rate);
        band
    }

    fn update_coefficients(&mut self, sample_rate: f32) {
        let w0 = 2.0 * std::f32::consts::PI * self.frequency / sample_rate;
        let cos_w0 = w0.cos();
        let sin_w0 = w0.sin();

        let a = 10.0_f32.powf(self.gain_db / 40.0); // sqrt of gain in linear

        let alpha = sin_w0 / (2.0 * self.q);

        // Peaking EQ coefficients
        let b0 = 1.0 + alpha * a;
        let b1 = -2.0 * cos_w0;
        let b2 = 1.0 - alpha * a;
        let a0 = 1.0 + alpha / a;
        let a1 = -2.0 * cos_w0;
        let a2 = 1.0 - alpha / a;

        // Normalize by a0
        self.b0 = b0 / a0;
        self.b1 = b1 / a0;
        self.b2 = b2 / a0;
        self.a1 = a1 / a0;
        self.a2 = a2 / a0;
    }

    /// Process a stereo sample through this band
    pub fn process(&mut self, left: f32, right: f32) -> (f32, f32) {
        let mut process_channel = |input: f32, ch: usize| -> f32 {
            let output = self.b0 * input
                + self.b1 * self.x1[ch]
                + self.b2 * self.x2[ch]
                - self.a1 * self.y1[ch]
                - self.a2 * self.y2[ch];

            self.x2[ch] = self.x1[ch];
            self.x1[ch] = input;
            self.y2[ch] = self.y1[ch];
            self.y1[ch] = output;

            output
        };

        let l = process_channel(left, 0);
        let r = process_channel(right, 1);

        (l, r)
    }

    /// Update the band's parameters
    pub fn set_params(&mut self, frequency: f32, gain_db: f32, q: f32, sample_rate: f32) {
        self.frequency = frequency;
        self.gain_db = gain_db;
        self.q = q;
        self.update_coefficients(sample_rate);
    }
}

/// 5-band Parametric EQ
pub struct ParametricEQ {
    pub bands: Vec<EQBand>,
    sample_rate: f32,
}

impl ParametricEQ {
    /// Create a new parametric EQ with default band frequencies
    pub fn new_default(sample_rate: u32) -> Self {
        let bands = vec![
            EQBand::new(60.0, 0.0, 1.0, sample_rate as f32),    // Sub bass
            EQBand::new(250.0, 0.0, 1.0, sample_rate as f32),   // Bass
            EQBand::new(1000.0, 0.0, 1.0, sample_rate as f32),  // Mid
            EQBand::new(4000.0, 0.0, 1.0, sample_rate as f32),  // Upper mid
            EQBand::new(12000.0, 0.0, 1.0, sample_rate as f32), // Treble
        ];

        Self {
            bands,
            sample_rate: sample_rate as f32,
        }
    }

    /// Process a stereo sample through all EQ bands
    pub fn process(&mut self, left: f32, right: f32) -> (f32, f32) {
        let (mut l, mut r) = (left, right);
        for band in &mut self.bands {
            (l, r) = band.process(l, r);
        }
        (l, r)
    }

    /// Set gain for a specific band
    pub fn set_band_gain(&mut self, band_index: usize, gain_db: f32) {
        if band_index < self.bands.len() {
            self.bands[band_index].gain_db = gain_db;
            self.bands[band_index].update_coefficients(self.sample_rate);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_eq_passthrough() {
        let mut eq = ParametricEQ::new_default(44100);
        // With 0dB gain on all bands, output should equal input
        let (l, r) = eq.process(0.5, 0.5);
        assert!((l - 0.5).abs() < 0.01);
        assert!((r - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_eq_gain() {
        let mut eq = ParametricEQ::new_default(44100);
        // Apply +12dB gain on mid band
        eq.set_band_gain(2, 12.0);
        // Process a few samples to let the filter settle
        let mut l = 0.5f32;
        let mut r = 0.5f32;
        for _ in 0..100 {
            (l, r) = eq.process(0.5, 0.5);
        }
        // Output should be boosted
        assert!(l > 0.5);
    }
}
