//! Brick-wall Limiter
//!
//! Prevents audio from exceeding a set ceiling level.
//! Essential for broadcast to prevent clipping and ensure consistent loudness.

/// Brick-wall limiter
pub struct Limiter {
    pub ceiling_db: f32,
    pub release_ms: f32,
    // Internal state
    gain_reduction: f32,
    sample_rate: f32,
}

impl Limiter {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            ceiling_db: -1.0,
            release_ms: 50.0,
            gain_reduction: 1.0,
            sample_rate: sample_rate as f32,
        }
    }

    /// Process a stereo sample through the limiter
    pub fn process(&mut self, left: f32, right: f32) -> (f32, f32) {
        let ceiling = db_to_linear(self.ceiling_db);

        // Calculate peak level
        let peak = left.abs().max(right.abs());

        if peak * self.gain_reduction > ceiling {
            // Need to reduce gain immediately
            self.gain_reduction = ceiling / peak.max(1e-10);
        } else {
            // Release - gradually return gain to 1.0
            let release_coeff = (-1.0 / (self.release_ms * 0.001 * self.sample_rate)).exp();
            self.gain_reduction = 1.0 + (self.gain_reduction - 1.0) * release_coeff;
        }

        (left * self.gain_reduction, right * self.gain_reduction)
    }

    /// Get current gain reduction in dB
    pub fn gain_reduction_db(&self) -> f32 {
        20.0 * self.gain_reduction.log10()
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
    fn test_limiter_ceiling() {
        let mut limiter = Limiter::new(44100);
        limiter.ceiling_db = -6.0; // ~0.5 linear
        // Process a loud signal
        for _ in 0..1000 {
            limiter.process(0.9, 0.9);
        }
        let (l, r) = limiter.process(0.9, 0.9);
        // Output should not exceed ceiling
        assert!(l <= 0.55); // Approximate ceiling with some tolerance
        assert!(r <= 0.55);
    }

    #[test]
    fn test_limiter_quiet_passthrough() {
        let mut limiter = Limiter::new(44100);
        // Quiet signal should pass through
        let (l, r) = limiter.process(0.1, 0.1);
        assert!((l - 0.1).abs() < 0.01);
    }
}
