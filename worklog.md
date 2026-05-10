---
Task ID: 5
Agent: Main Agent
Task: Add missing UI features: username in stream setup, input/output device selection, subscription management, multi-server, polished faders

Work Log:
- Updated LiveStream page with collapsible panels for Server Configuration, Audio Devices, Multi-Server Output
- Added username/login field with contextual hint to both LiveStream and Settings
- Added separate input device (capture) and output device (monitor) selection
- Added multi-server streaming config (Pro/Studio gated) with add/remove/configure
- Added subscription badge and upgrade CTA to LiveStream and Sidebar
- Updated Store with outputDevice, sampleRate, bufferSize, channels, additionalServers
- Updated subscription store with Electron IPC for PesaPal server-side API calls
- Updated types with SubscriptionIPCResult, SubscriptionVerifyResult, new EngineCommands
- Updated Electron main.js with full PesaPal backend and shell.openExternal
- Updated Electron preload.js with subscription and openExternal IPC
- Updated Rust engine with AddServer, RemoveServer, SetOutputDevice, SetAutoReconnect commands
- Updated Rust capture.rs to list both input AND output devices
- Created RotaryKnob.tsx and VerticalFader.tsx professional audio UI components
- Updated MixerChannel with polished faders and per-channel device assignment
- Updated Mixer page with tier-gated DSP and professional knobs
- Fixed Settings.tsx bug: d.d.isInput → d.isInput

Stage Summary:
- All missing UI features added: username, input/output devices, subscription, multi-server
- Professional audio controls replace basic HTML range inputs
- PesaPal subscription uses secure server-side Electron IPC
- Per-channel device assignment in mixer
