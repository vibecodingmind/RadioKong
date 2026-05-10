import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { LiveStream } from './pages/LiveStream'
import { Mixer } from './pages/Mixer'
import { Settings } from './pages/Settings'
import { Recordings } from './pages/Recordings'
import { AuthPage } from './pages/Auth'
import { useAuthStore } from './store/auth'
import { useSubscriptionStore } from './store/subscription'
import { useAudioEngine } from './hooks/useAudioEngine'
import { useStreamStatus } from './hooks/useStreamStatus'

export default function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth)
  const checkStatus = useSubscriptionStore((s) => s.checkStatus)

  // Initialize the audio engine IPC bridge — this registers the message
  // listener that handles stream_status, vu_meter, waveform, devices, etc.
  useAudioEngine()
  // Track stream uptime (real VU/waveform data comes from useAudioEngine)
  useStreamStatus()

  // Initialize auth and subscription state from localStorage
  useEffect(() => {
    checkAuth()
    checkStatus()
  }, [checkAuth, checkStatus])

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/stream" element={<LiveStream />} />
              <Route path="/mixer" element={<Mixer />} />
              <Route path="/recordings" element={<Recordings />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  )
}
