//! DSP (Digital Signal Processing) module
//!
//! Provides real-time audio effects:
//! - Parametric EQ (5-band)
//! - Compressor
//! - Limiter
//! - Noise Gate
//! - De-Esser

pub mod eq;
pub mod compressor;
pub mod limiter;
pub mod gate;

use crate::dsp::eq::ParametricEQ;
use crate::dsp::compressor::Compressor;
use crate::dsp::limiter::Limiter;
use crate::dsp::gate::NoiseGate;

/// DSP processing chain
pub struct DSPPipeline {
    pub eq: ParametricEQ,
    pub compressor: Compressor,
    pub limiter: Limiter,
    pub gate: NoiseGate,
    pub eq_enabled: bool,
    pub compressor_enabled: bool,
    pub limiter_enabled: bool,
    pub gate_enabled: bool,
}

impl DSPPipeline {
    /// Create a new DSP pipeline with default settings
    pub fn new(sample_rate: u32) -> Self {
        Self {
            eq: ParametricEQ::new_default(sample_rate),
            compressor: Compressor::new(sample_rate),
            limiter: Limiter::new(sample_rate),
            gate: NoiseGate::new(sample_rate),
            eq_enabled: false,
            compressor_enabled: false,
            limiter_enabled: true,
            gate_enabled: false,
        }
    }

    /// Process a stereo audio buffer through the DSP chain
    pub fn process(&mut self, buffer: &mut [f32]) {
        let frames = buffer.len() / 2;

        for i in 0..frames {
            let left = buffer[i * 2];
            let right = buffer[i * 2 + 1];

            let (l, r) = self.process_sample(left, right);

            buffer[i * 2] = l;
            buffer[i * 2 + 1] = r;
        }
    }

    /// Process a single stereo sample through the DSP chain
    fn process_sample(&mut self, left: f32, right: f32) -> (f32, f32) {
        let (mut l, mut r) = (left, right);

        // Gate (first in chain - remove silence/noise)
        if self.gate_enabled {
            (l, r) = self.gate.process(l, r);
        }

        // EQ (shape the tone)
        if self.eq_enabled {
            (l, r) = self.eq.process(l, r);
        }

        // Compressor (dynamics control)
        if self.compressor_enabled {
            (l, r) = self.compressor.process(l, r);
        }

        // Limiter (final safety - prevent clipping)
        if self.limiter_enabled {
            (l, r) = self.limiter.process(l, r);
        }

        (l, r)
    }
}
