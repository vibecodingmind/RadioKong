"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAudioStore } from "./audio-store";

export function useAudioEngine() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
  const animFrameRef = useRef<number>(0);
  const splitterRef = useRef<ChannelSplitterNode | null>(null);
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);

  const isLive = useAudioStore((s) => s.isLive);
  const dsp = useAudioStore((s) => s.dsp);
  const channels = useAudioStore((s) => s.channels);

  const startAudioCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Create EQ filters (3-band)
      const eqFilters: BiquadFilterNode[] = [];
      const frequencies = [200, 1000, 4000];
      const filterTypes: BiquadFilterType[] = ["lowshelf", "peaking", "highshelf"];
      const currentDsp = useAudioStore.getState().dsp;

      for (let i = 0; i < 3; i++) {
        const filter = audioContext.createBiquadFilter();
        filter.type = filterTypes[i];
        filter.frequency.value = currentDsp.eq[i]?.frequency ?? frequencies[i];
        filter.gain.value = currentDsp.eq[i]?.gain ?? 0;
        if (filter.type === "peaking") {
          filter.Q.value = currentDsp.eq[i]?.q ?? 1.0;
        }
        eqFilters.push(filter);
      }
      eqFiltersRef.current = eqFilters;

      // Create compressor
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = currentDsp.compressor.threshold;
      compressor.ratio.value = currentDsp.compressor.ratio;
      compressor.attack.value = currentDsp.compressor.attack / 1000;
      compressor.release.value = currentDsp.compressor.release / 1000;
      compressorRef.current = compressor;

      // Create gain node (master)
      const gainNode = audioContext.createGain();
      const micChannel = useAudioStore.getState().channels.find((ch) => ch.id === "mic");
      gainNode.gain.value = micChannel ? (micChannel.mute ? 0 : micChannel.volume) : 0.75;
      gainNodeRef.current = gainNode;

      // Create stereo analyser setup
      const splitter = audioContext.createChannelSplitter(2);
      splitterRef.current = splitter;

      const analyserL = audioContext.createAnalyser();
      analyserL.fftSize = 2048;
      analyserL.smoothingTimeConstant = 0.8;
      analyserLRef.current = analyserL;

      const analyserR = audioContext.createAnalyser();
      analyserR.fftSize = 2048;
      analyserR.smoothingTimeConstant = 0.8;
      analyserRRef.current = analyserR;

      // Main analyser for waveform
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Chain: source -> EQ filters -> compressor -> gain -> splitter -> analysers
      let lastNode: AudioNode = source;

      for (const filter of eqFilters) {
        lastNode.connect(filter);
        lastNode = filter;
      }

      lastNode.connect(compressor);
      compressor.connect(gainNode);
      gainNode.connect(analyser);

      // Split to L/R for VU meters
      analyser.connect(splitter);
      splitter.connect(analyserL, 0);
      splitter.connect(analyserR, 1);

      // Connect to destination (for monitoring)
      analyser.connect(audioContext.destination);

      // Start VU meter update loop
      const dataArrayL = new Uint8Array(analyserL.frequencyBinCount);
      const dataArrayR = new Uint8Array(analyserR.frequencyBinCount);

      let peakL = 0;
      let peakR = 0;
      const peakDecay = 0.98;

      const updateLevels = () => {
        if (!analyserLRef.current || !analyserRRef.current) return;

        analyserLRef.current.getByteFrequencyData(dataArrayL);
        analyserRRef.current.getByteFrequencyData(dataArrayR);

        // Calculate RMS level
        let sumL = 0;
        let sumR = 0;
        for (let i = 0; i < dataArrayL.length; i++) {
          const vL = dataArrayL[i] / 255;
          const vR = dataArrayR[i] / 255;
          sumL += vL * vL;
          sumR += vR * vR;
        }
        const rmsL = Math.sqrt(sumL / dataArrayL.length);
        const rmsR = Math.sqrt(sumR / dataArrayR.length);

        // Update peaks with decay
        if (rmsL > peakL) peakL = rmsL;
        else peakL *= peakDecay;

        if (rmsR > peakR) peakR = rmsR;
        else peakR *= peakDecay;

        useAudioStore.getState().setLevels(rmsL, rmsR, peakL, peakR);
        animFrameRef.current = requestAnimationFrame(updateLevels);
      };

      animFrameRef.current = requestAnimationFrame(updateLevels);

      useAudioStore.getState().setIsLive(true);
      useAudioStore.getState().setStreamHealth({
        connected: true,
        uptime: 0,
        currentBitrate: useAudioStore.getState().streamConnection.bitrate,
        bufferLevel: 85,
        droppedFrames: 0,
        bandwidthUsage: useAudioStore.getState().streamConnection.bitrate + 4,
      });
    } catch (err) {
      console.error("Failed to capture audio:", err);
      useAudioStore.getState().setIsLive(false);
      useAudioStore.getState().setStreamHealth({
        connected: false,
        uptime: 0,
        currentBitrate: 0,
        bufferLevel: 0,
        droppedFrames: 0,
        bandwidthUsage: 0,
      });
    }
  }, []);

  const stopAudioCapture = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    gainNodeRef.current = null;
    compressorRef.current = null;
    eqFiltersRef.current = [];
    splitterRef.current = null;
    analyserLRef.current = null;
    analyserRRef.current = null;

    useAudioStore.getState().setIsLive(false);
    useAudioStore.getState().setLevels(0, 0, 0, 0);
    useAudioStore.getState().setStreamHealth({
      connected: false,
      uptime: 0,
      currentBitrate: 0,
      bufferLevel: 0,
      droppedFrames: 0,
      bandwidthUsage: 0,
    });
  }, []);

  // Update EQ when DSP changes
  useEffect(() => {
    if (eqFiltersRef.current.length === 3) {
      const filterTypes: BiquadFilterType[] = ["lowshelf", "peaking", "highshelf"];
      for (let i = 0; i < 3; i++) {
        const filter = eqFiltersRef.current[i];
        if (filter) {
          filter.type = dsp.eqBypass ? "peaking" : filterTypes[i];
          filter.frequency.value = dsp.eq[i]?.frequency ?? 1000;
          filter.gain.value = dsp.eqBypass ? 0 : (dsp.eq[i]?.gain ?? 0);
          if (filter.type === "peaking") {
            filter.Q.value = dsp.eq[i]?.q ?? 1.0;
          }
        }
      }
    }
  }, [dsp.eq, dsp.eqBypass]);

  // Update compressor when DSP changes
  useEffect(() => {
    if (compressorRef.current) {
      compressorRef.current.threshold.value = dsp.compressor.bypass ? 0 : dsp.compressor.threshold;
      compressorRef.current.ratio.value = dsp.compressor.bypass ? 1 : dsp.compressor.ratio;
      compressorRef.current.attack.value = dsp.compressor.attack / 1000;
      compressorRef.current.release.value = dsp.compressor.release / 1000;
    }
  }, [dsp.compressor]);

  // Update master gain from mic channel volume
  useEffect(() => {
    if (gainNodeRef.current) {
      const micChannel = channels.find((ch) => ch.id === "mic");
      if (micChannel) {
        gainNodeRef.current.gain.value = micChannel.mute ? 0 : micChannel.volume;
      }
    }
  }, [channels]);

  // Uptime counter - runs when live
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      const health = useAudioStore.getState().streamHealth;
      if (health.connected) {
        useAudioStore.getState().setStreamHealth({
          uptime: health.uptime + 1,
          bufferLevel: Math.max(60, Math.min(100, health.bufferLevel + (Math.random() - 0.5) * 2)),
          bandwidthUsage: health.currentBitrate + Math.floor((Math.random() - 0.5) * 10),
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLive]);

  return {
    startAudioCapture,
    stopAudioCapture,
    analyser: analyserRef,
    audioContext: audioContextRef,
  };
}
