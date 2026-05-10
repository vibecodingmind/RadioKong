"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAudioStore } from "./audio-store";
import { getStreamClient, type StreamStatus } from "./stream-client";
import { saveRecording, type Recording } from "./recorder";
import { loadSettings, saveSettings, type PersistedSettings } from "./settings-persistence";

export function useAudioEngine() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
  const limiterNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const gateNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const splitterRef = useRef<ChannelSplitterNode | null>(null);
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordStartTimeRef = useRef<number>(0);
  const streamClientRef = useRef(getStreamClient());
  const streamDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const streamRecorderRef = useRef<MediaRecorder | null>(null);

  const isLive = useAudioStore((s) => s.isLive);
  const dsp = useAudioStore((s) => s.dsp);
  const channels = useAudioStore((s) => s.channels);
  const isRecording = useAudioStore((s) => s.isRecording);
  const metadata = useAudioStore((s) => s.metadata);
  const streamConnection = useAudioStore((s) => s.streamConnection);

  // ─── Load saved settings on mount ───
  useEffect(() => {
    const saved = loadSettings();
    if (saved) {
      const { setStreamConnection, setDsp } = useAudioStore.getState();
      setStreamConnection(saved.streamConnection);
      setDsp(saved.dsp);
    }
  }, []);

  // ─── Save settings when they change ───
  useEffect(() => {
    const state = useAudioStore.getState();
    const settings: PersistedSettings = {
      streamConnection: state.streamConnection,
      dsp: state.dsp,
      recordingsFolder: "",
    };
    saveSettings(settings);
  }, [streamConnection, dsp]);

  // ─── Stream client status listener ───
  useEffect(() => {
    const client = streamClientRef.current;

    client.onStatusChange((status: StreamStatus, error?: string) => {
      const { setStreamHealth, setIsLive } = useAudioStore.getState();

      if (status === "connected") {
        setStreamHealth({
          connected: true,
          uptime: 0,
          currentBitrate: useAudioStore.getState().streamConnection.bitrate,
          bufferLevel: 85,
          droppedFrames: 0,
          bandwidthUsage: useAudioStore.getState().streamConnection.bitrate + 4,
        });
      } else if (status === "error") {
        setStreamHealth({
          connected: false,
          uptime: 0,
          currentBitrate: 0,
          bufferLevel: 0,
          droppedFrames: 0,
          bandwidthUsage: 0,
        });
        if (error) {
          console.error("[StreamClient] Error:", error);
        }
      } else if (status === "disconnected") {
        setStreamHealth({
          connected: false,
          uptime: 0,
          currentBitrate: 0,
          bufferLevel: 0,
          droppedFrames: 0,
          bandwidthUsage: 0,
        });
      }
    });

    return () => {
      client.destroy();
    };
  }, []);

  // ─── Start Audio Capture ───
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

      const audioContext = new AudioContext({ sampleRate: 44100 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const currentDsp = useAudioStore.getState().dsp;

      // ─── EQ filters (3-band) ───
      const eqFilters: BiquadFilterNode[] = [];
      const frequencies = [200, 1000, 4000];
      const filterTypes: BiquadFilterType[] = ["lowshelf", "peaking", "highshelf"];

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

      // ─── Compressor ───
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = currentDsp.compressor.bypass ? 0 : currentDsp.compressor.threshold;
      compressor.ratio.value = currentDsp.compressor.bypass ? 1 : currentDsp.compressor.ratio;
      compressor.attack.value = currentDsp.compressor.attack / 1000;
      compressor.release.value = currentDsp.compressor.release / 1000;
      compressorRef.current = compressor;

      // ─── Noise Gate (implemented as extreme downward expander via compressor) ───
      const gate = audioContext.createDynamicsCompressor();
      gate.threshold.value = currentDsp.gate.bypass ? -100 : currentDsp.gate.threshold;
      gate.ratio.value = currentDsp.gate.bypass ? 1 : 20; // extreme ratio for gating
      gate.attack.value = 0.001; // very fast attack
      gate.release.value = currentDsp.gate.release / 1000;
      gate.knee.value = 0; // hard knee for gate
      gateNodeRef.current = gate;

      // ─── Limiter (brick-wall via compressor with high ratio) ───
      const limiter = audioContext.createDynamicsCompressor();
      limiter.threshold.value = currentDsp.limiter.bypass ? 0 : currentDsp.limiter.ceiling;
      limiter.ratio.value = currentDsp.limiter.bypass ? 1 : 20; // brick wall
      limiter.attack.value = 0.001; // near-instant attack
      limiter.release.value = currentDsp.limiter.release / 1000;
      limiter.knee.value = 0; // hard knee
      limiterNodeRef.current = limiter;

      // ─── Master Gain ───
      const gainNode = audioContext.createGain();
      const micChannel = useAudioStore.getState().channels.find((ch) => ch.id === "mic");
      gainNode.gain.value = micChannel ? (micChannel.mute ? 0 : micChannel.volume) : 0.75;
      gainNodeRef.current = gainNode;

      // ─── Stereo analyser setup ───
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

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // ─── Stream destination (for streaming to Icecast) ───
      const streamDest = audioContext.createMediaStreamDestination();
      streamDestinationRef.current = streamDest;

      // ─── Audio chain ───
      // source → EQ → Compressor → Gate → Limiter → Gain → analyser → splitter → L/R analysers
      //                                                                → streamDest (for streaming)
      let lastNode: AudioNode = source;

      for (const filter of eqFilters) {
        lastNode.connect(filter);
        lastNode = filter;
      }

      lastNode.connect(compressor);
      compressor.connect(gate);
      gate.connect(limiter);
      limiter.connect(gainNode);

      // Connect gain to analyser
      gainNode.connect(analyser);

      // Split to L/R for VU meters
      analyser.connect(splitter);
      splitter.connect(analyserL, 0);
      splitter.connect(analyserR, 1);

      // Connect to destination (monitoring)
      analyser.connect(audioContext.destination);

      // Also connect to stream destination (for Icecast streaming)
      gainNode.connect(streamDest);

      // ─── Start streaming to relay server ───
      const conn = useAudioStore.getState().streamConnection;
      try {
        await streamClientRef.current.connect({
          host: conn.host,
          port: conn.port,
          password: conn.password,
          mount: conn.mount,
          codec: conn.codec,
          bitrate: conn.bitrate,
          serverType: conn.serverType,
        });

        // Start a MediaRecorder to capture the processed audio for streaming
        if (streamDest.stream.getAudioTracks().length > 0) {
          const streamRecorder = new MediaRecorder(streamDest.stream, {
            mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
              ? "audio/webm;codecs=opus"
              : "audio/webm",
          });

          streamRecorder.ondataavailable = async (e) => {
            if (e.data.size > 0) {
              try {
                await streamClientRef.current.sendChunk(e.data);
              } catch {
                // Relay might be temporarily unavailable
              }
            }
          };

          streamRecorder.start(250); // Send chunks every 250ms
          streamRecorderRef.current = streamRecorder;
        }
      } catch (err: any) {
        console.warn("[Stream] Could not connect to relay server:", err.message);
        // Still allow local monitoring even if relay is down
        useAudioStore.getState().setStreamHealth({
          connected: false,
          uptime: 0,
          currentBitrate: 0,
          bufferLevel: 0,
          droppedFrames: 0,
          bandwidthUsage: 0,
        });
      }

      // ─── VU meter update loop ───
      const dataArrayL = new Uint8Array(analyserL.frequencyBinCount);
      const dataArrayR = new Uint8Array(analyserR.frequencyBinCount);

      let peakL = 0;
      let peakR = 0;
      const peakDecay = 0.98;

      const updateLevels = () => {
        if (!analyserLRef.current || !analyserRRef.current) return;

        analyserLRef.current.getByteFrequencyData(dataArrayL);
        analyserRRef.current.getByteFrequencyData(dataArrayR);

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

        if (rmsL > peakL) peakL = rmsL;
        else peakL *= peakDecay;

        if (rmsR > peakR) peakR = rmsR;
        else peakR *= peakDecay;

        useAudioStore.getState().setLevels(rmsL, rmsR, peakL, peakR);
        animFrameRef.current = requestAnimationFrame(updateLevels);
      };

      animFrameRef.current = requestAnimationFrame(updateLevels);
      useAudioStore.getState().setIsLive(true);
    } catch (err) {
      console.error("Failed to capture audio:", err);
      useAudioStore.getState().setIsLive(false);
    }
  }, []);

  // ─── Stop Audio Capture ───
  const stopAudioCapture = useCallback(() => {
    // Stop streaming recorder
    if (streamRecorderRef.current && streamRecorderRef.current.state !== "inactive") {
      streamRecorderRef.current.stop();
      streamRecorderRef.current = null;
    }

    // Disconnect from relay server
    streamClientRef.current.disconnect();

    // Stop recording if active
    if (isRecording) {
      stopRecordingInternal();
      useAudioStore.getState().setIsRecording(false);
    }

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
    limiterNodeRef.current = null;
    gateNodeRef.current = null;
    splitterRef.current = null;
    analyserLRef.current = null;
    analyserRRef.current = null;
    streamDestinationRef.current = null;

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
  }, [isRecording]);

  // ─── Recording ───
  const startRecording = useCallback(() => {
    if (!audioContextRef.current || !analyserRef.current) return;

    // Create a MediaRecorder from the stream destination
    const dest = streamDestinationRef.current;
    if (!dest) return;

    const chunks: Blob[] = [];
    recordedChunksRef.current = chunks;
    recordStartTimeRef.current = Date.now();

    const recorder = new MediaRecorder(dest.stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm",
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.start(1000); // Collect chunks every second
    mediaRecorderRef.current = recorder;
    useAudioStore.getState().setIsRecording(true);
  }, []);

  const stopRecordingInternal = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        const chunks = recordedChunksRef.current;
        if (chunks.length === 0) {
          resolve();
          return;
        }

        const blob = new Blob(chunks, { type: "audio/webm" });
        const duration = (Date.now() - recordStartTimeRef.current) / 1000;
        const meta = useAudioStore.getState().metadata;

        const recording: Recording = {
          id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: meta.title || "Untitled Recording",
          artist: meta.artist || "RadioKong",
          date: new Date().toISOString(),
          duration,
          size: blob.size,
          blob,
          format: "audio/webm",
        };

        try {
          await saveRecording(recording);
        } catch (err) {
          console.error("[Recorder] Failed to save recording:", err);
        }

        mediaRecorderRef.current = null;
        recordedChunksRef.current = [];
        resolve();
      };

      recorder.stop();
    });
  }, []);

  const stopRecording = useCallback(async () => {
    await stopRecordingInternal();
    useAudioStore.getState().setIsRecording(false);
  }, [stopRecordingInternal]);

  // ─── Send metadata to Icecast ───
  const sendMetadata = useCallback(async () => {
    const { streamConnection, metadata } = useAudioStore.getState();

    try {
      // Try via the Next.js API route (works even if relay is not connected)
      const response = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: streamConnection.host,
          port: streamConnection.port,
          password: streamConnection.password,
          mount: streamConnection.mount,
          title: metadata.title,
          artist: metadata.artist,
          serverType: streamConnection.serverType,
        }),
      });

      const data = await response.json();
      return data.success === true;
    } catch (err: any) {
      console.error("[Metadata] Failed to send:", err.message);
      return false;
    }
  }, []);

  // ─── Test Connection ───
  const testConnection = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    const { streamConnection } = useAudioStore.getState();

    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: streamConnection.host,
          port: streamConnection.port,
          password: streamConnection.password,
          mount: streamConnection.mount,
          serverType: streamConnection.serverType,
        }),
      });

      return await response.json();
    } catch (err: any) {
      return { success: false, message: err.message || "Connection test failed" };
    }
  }, []);

  // ─── Update EQ when DSP changes ───
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

  // ─── Update compressor when DSP changes ───
  useEffect(() => {
    if (compressorRef.current) {
      compressorRef.current.threshold.value = dsp.compressor.bypass ? 0 : dsp.compressor.threshold;
      compressorRef.current.ratio.value = dsp.compressor.bypass ? 1 : dsp.compressor.ratio;
      compressorRef.current.attack.value = dsp.compressor.attack / 1000;
      compressorRef.current.release.value = dsp.compressor.release / 1000;
    }
  }, [dsp.compressor]);

  // ─── Update noise gate when DSP changes ───
  useEffect(() => {
    if (gateNodeRef.current) {
      gateNodeRef.current.threshold.value = dsp.gate.bypass ? -100 : dsp.gate.threshold;
      gateNodeRef.current.ratio.value = dsp.gate.bypass ? 1 : 20;
      gateNodeRef.current.release.value = dsp.gate.release / 1000;
    }
  }, [dsp.gate]);

  // ─── Update limiter when DSP changes ───
  useEffect(() => {
    if (limiterNodeRef.current) {
      limiterNodeRef.current.threshold.value = dsp.limiter.bypass ? 0 : dsp.limiter.ceiling;
      limiterNodeRef.current.ratio.value = dsp.limiter.bypass ? 1 : 20;
      limiterNodeRef.current.release.value = dsp.limiter.release / 1000;
    }
  }, [dsp.limiter]);

  // ─── Update master gain from mic channel volume ───
  useEffect(() => {
    if (gainNodeRef.current) {
      const micChannel = channels.find((ch) => ch.id === "mic");
      if (micChannel) {
        gainNodeRef.current.gain.value = micChannel.mute ? 0 : micChannel.volume;
      }
    }
  }, [channels]);

  // ─── Uptime counter ───
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
    startRecording,
    stopRecording,
    sendMetadata,
    testConnection,
    analyser: analyserRef,
    audioContext: audioContextRef,
  };
}
