import CounterBar from './components/CounterBar';
import Ticker from "./components/Ticker";

export default function Home() {
  return (
    <main className="min-h-screen py-8 px-4">
      <header className="max-w-3xl mx-auto mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <span className="text-2xl">💧</span>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
            Spraay Live
          </h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] max-w-xl mx-auto">
  Live x402 gateway activity. Scans, intents, payments — as they happen.
</p>
      </header>

      <CounterBar />
      <Ticker />

      <footer className="max-w-3xl mx-auto mt-8 text-center">
        <p className="text-xs text-[var(--text-muted)]">
          powered by <a href="https://spraay.app" className="text-[var(--spraay-blue)] hover:text-[var(--spraay-cyan)]">spraay.app</a>
        </p>
      </footer>
    </main>
  );
}