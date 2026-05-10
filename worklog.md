---
Task ID: 1-7
Agent: Main Agent
Task: Connect all UI elements to the Rust engine via IPC — fix 7 identified gaps

Work Log:
- Analyzed all project files to identify actual gaps (project uses Electron + Rust sidecar, not Tauri)
- Fix 1: Removed fake VU simulation from `useStreamStatus.ts` that overrode real engine data
- Fix 1b: Added `useAudioEngine()` and `useStreamStatus()` calls to `App.tsx` (the engine message listener was never registered!)
- Fix 2: Rewrote `MixerChannel.tsx` to send `set_volume`, `set_mute`, `set_solo`, `set_pan`, `set_channel_device` IPC commands alongside store updates
- Fix 3: Updated `Mixer.tsx` to send `set_volume`/`set_mute` for "master" channel; updated Rust `main.rs` to route master commands to `mixer.set_master_volume()`/`mixer.set_master_mute()`
- Fix 4: Replaced `setTimeout(() => setStreaming(true), 1500)` in `LiveStream.tsx` with proper flow that waits for engine's `stream_status` message (with 15s safety timeout)
- Fix 5: Added `format` field to `StartRecording` Rust command; engine now respects the selected format for file extension; updated `Recordings.tsx` to send format with recording command
- Fix 6: Added `deleteFile` IPC handler in `electron/main.js` + `preload.js`; updated `Recordings.tsx` to actually delete files on disk when removing recordings
- Fix 7: Fixed `RemoveServer { id: _ }` Rust bug → `RemoveServer { id }`; added `engineError` state to Zustand store; added `EngineErrorToast` component for global error display; updated `useAudioEngine` to set errors
- Updated TypeScript types in `types/index.ts` for new `deleteFile` and `start_recording` format fields
- Verified TypeScript compiles cleanly with `tsc --noEmit`

Stage Summary:
- All 7 gaps are now fixed and TypeScript compiles without errors
- Rust changes can't be compiled locally due to missing ALSA system library (build env issue, not code issue)
- Key files modified: App.tsx, LiveStream.tsx, Mixer.tsx, MixerChannel.tsx, Recordings.tsx, useAudioEngine.ts, useStreamStatus.ts, store/index.ts, types/index.ts, Layout.tsx, EngineErrorToast.tsx (new), electron/main.js, electron/preload.js, engine/src/main.rs, engine/src/lib.rs
