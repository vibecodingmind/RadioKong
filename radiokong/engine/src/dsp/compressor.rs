//! Dynamic Range Compressor
//!
//! Reduces the dynamic range of audio by attenuating loud signals.
//! Features: threshold, ratio, attack, release, and makeup gain.

/// Dynamic range compressor
pub struct Compressor {
    pub threshold_db: f32,
    pub ratio: f32,
    pub attack_ms: f32,
    pub release_ms: f32,
    pub makeup_gain_db: f32,
    // Internal state
    envelope: f32,
    sample_rate: f32,
}

impl Compressor {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            threshold_db: -20.0,
            ratio: 4.0,
            attack_ms: 10.0,
            release_ms: 100.0,
            makeup_gain_db: 0.0,
            envelope: 0.0,
            sample_rate: sample_rate as f32,
        }
    }

    /// Process a stereo sample through the compressor
    pub fn process(&mut self, left: f32, right: f32) -> (f32, f32) {
        // Calculate input level (peak detection)
        let input_level = left.abs().max(right.abs());

        // Convert to dB
        let input_db = linear_to_db(input_level.max(1e-10));

        // Calculate gain reduction
        let gain_reduction_db = if input_db > self.threshold_db {
            (self.threshold_db - input_db) * (1.0 - 1.0 / self.ratio)
        } else {
            0.0
        };

        // Smooth the gain reduction (envelope follower)
        let target = db_to_linear(gain_reduction_db);

        // Attack/release coefficients
        let attack_coeff = (-1.0 / (self.attack_ms * 0.001 * self.sample_rate)).exp();
        let release_coeff = (-1.0 / (self.release_ms * 0.001 * self.sample_rate)).exp();

        if target < self.envelope {
            // Attack (gain is decreasing)
            self.envelope = target + (self.envelope - target) * attack_coeff;
        } else {
            // Release (gain is increasing)
            self.envelope = target + (self.envelope - target) * release_coeff;
        }

        // Apply gain reduction + makeup gain
        let makeup_gain = db_to_linear(self.makeup_gain_db);
        let gain = self.envelope * makeup_gain;

        (left * gain, right * gain)
    }

    /// Get the current gain reduction in dB (for metering)
    pub fn gain_reduction_db(&self) -> f32 {
        linear_to_db(self.envelope.max(1e-10))
    }
}

#[inline]
fn linear_to_db(linear: f32) -> f32 {
    20.0 * linear.log10()
}

#[inline]
fn db_to_linear(db: f32) -> f32 {
    10.0_f32.powf(db / 20.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compressor_below_threshold() {
        let mut comp = Compressor::new(44100);
        comp.threshold_db = -10.0;
        // Signal below threshold should not be compressed
        let (l, r) = comp.process(0.01, 0.01);
        assert!((l - 0.01).abs() < 0.01);
    }

    #[test]
    fn test_compressor_above_threshold() {
        let mut comp = Compressor::new(44100);
        comp.threshold_db = -20.0;
        comp.ratio = 10.0;
        // Process many samples to let envelope settle
        let mut l = 0.0f32;
        let mut r = 0.0f32;
        for _ in 0..10000 {
            (l, r) = comp.process(0.8, 0.8);
        }
        // Output should be significantly reduced
        assert!(l < 0.8);
    }
}
