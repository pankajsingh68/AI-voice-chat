import Header from './components/Header'
import AudioRecorder from './components/AudioRecorder'
import LiveTranscript from './components/LiveTranscript'
import AnalysisPanel from './components/AnalysisPanel'
import { useSession } from './context/SessionContext'

export default function App() {
  const { mode } = useSession()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {/* ── Recording Controls ── */}
        <div className="flex justify-center mb-8">
          <AudioRecorder />
        </div>

        {/* ── Content Grid ── */}
        <div className={`grid gap-6 ${mode === 'coach' ? 'lg:grid-cols-5' : 'lg:grid-cols-1 max-w-2xl mx-auto'}`}>
          {/* Transcript — left / full */}
          <div className={mode === 'coach' ? 'lg:col-span-3' : ''}>
            <div className="glass-card p-5">
              <h2 className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow shadow-teal-400/50" />
                Live Transcript
              </h2>
              <LiveTranscript />
            </div>
          </div>

          {/* Analysis Panel — right (coach mode only) */}
          {mode === 'coach' && (
            <div className="lg:col-span-2">
              <div className="glass-card p-5">
                <AnalysisPanel />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <footer className="text-center mt-12 pb-6">
          <p className="text-[11px] text-gray-600">
            EchoCoach uses OpenAI Whisper &amp; GPT-4o. Your audio is processed in real-time and not stored.
          </p>
        </footer>
      </main>
    </div>
  )
}
