import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { LiveStream } from './pages/LiveStream'
import { Mixer } from './pages/Mixer'
import { Settings } from './pages/Settings'
import { Recordings } from './pages/Recordings'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/stream" element={<LiveStream />} />
        <Route path="/mixer" element={<Mixer />} />
        <Route path="/recordings" element={<Recordings />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}
