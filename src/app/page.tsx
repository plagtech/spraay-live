import RiveHero from './components/RiveHero';
import CompactStats from './components/CompactStats';
import EndpointCount from './components/EndpointCount';
import Ticker from './components/Ticker';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Rive landscape hero */}
      <RiveHero />

      {/* Compact stats bar pinned below hero */}
      <CompactStats />

      {/* Endpoint count */}
      <div className="text-center py-3">
        <EndpointCount />
      </div>

      {/* Live ticker */}
      <div className="flex-1 px-4 pb-8 fade-up fade-up-1">
        <Ticker />
      </div>

      {/* Footer */}
      <footer className="text-center pb-6">
        <p className="text-xs text-[var(--text-muted)]">
          powered by{' '}
          <a
            href="https://spraay.app"
            className="text-[var(--spraay-blue)] hover:text-[var(--spraay-cyan)] transition-colors"
          >
            spraay.app
          </a>
        </p>
      </footer>
    </main>
  );
}
