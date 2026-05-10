//! Noise Gate
//!
//! Silences audio below a threshold to remove background noise.
//! Features: threshold, attack, release, and hold controls.

/// Noise gate
pub struct NoiseGate {
    pub threshold_db: f32,
    pub attack_ms: f32,
    pub release_ms: f32,
    pub hold_ms: f32,
    // Internal state
    gate_open: bool,
    gain: f32,
    hold_counter: u32,
    sample_rate: f32,
}

impl NoiseGate {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            threshold_db: -40.0,
            attack_ms: 1.0,
            release_ms: 100.0,
            hold_ms: 50.0,
            gate_open: false,
            gain: 0.0,
            hold_counter: 0,
            sample_rate: sample_rate as f32,
        }
    }

    /// Process a stereo sample through the noise gate
    pub fn process(&mut self, left: f32, right: f32) -> (f32, f32) {
        let threshold = db_to_linear(self.threshold_db);

        // Calculate input level
        let input_level = left.abs().max(right.abs());

        // Gate logic
        if input_level > threshold {
            if !self.gate_open {
                self.gate_open = true;
                self.hold_counter = 0;
            }
        } else if self.gate_open {
            self.hold_counter += 1;
            let hold_samples = (self.hold_ms * 0.001 * self.sample_rate) as u32;
            if self.hold_counter > hold_samples {
                self.gate_open = false;
            }
        }

        // Calculate target gain
        let target_gain = if self.gate_open { 1.0 } else { 0.0 };

        // Smooth gain transitions
        if self.gate_open {
            let attack_coeff = (-1.0 / (self.attack_ms * 0.001 * self.sample_rate)).exp();
            self.gain = target_gain + (self.gain - target_gain) * attack_coeff;
        } else {
            let release_coeff = (-1.0 / (self.release_ms * 0.001 * self.sample_rate)).exp();
            self.gain = target_gain + (self.gain - target_gain) * release_coeff;
        }

        (left * self.gain, right * self.gain)
    }
}

#[inline]
fn db_to_linear(db: f32) -> f32 {
    10.0_f32.powf(db / 20.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gate_below_threshold() {
        let mut gate = NoiseGate::new(44100);
        gate.threshold_db = -20.0;
        // Process many samples of quiet signal
        let mut l = 0.0f32;
        let mut r = 0.0f32;
        for _ in 0..10000 {
            (l, r) = gate.process(0.001, 0.001);
        }
        // Output should be near zero (gate closed)
        assert!(l < 0.001);
    }

    #[test]
    fn test_gate_above_threshold() {
        let mut gate = NoiseGate::new(44100);
        gate.threshold_db = -20.0;
        // Process loud signal
        let mut l = 0.0f32;
        let mut r = 0.0f32;
        for _ in 0..10000 {
            (l, r) = gate.process(0.5, 0.5);
        }
        // Output should pass through (gate open)
        assert!((l - 0.5).abs() < 0.1);
    }
}
