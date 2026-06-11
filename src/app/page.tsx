import NocDashboard from "./components/noc/NocDashboard";
import EndpointCount from "./components/EndpointCount";

export default function Home() {
  return (
    <main className="min-h-screen py-6 px-4">
      <div className="max-w-[1240px] mx-auto">
        <NocDashboard />

        <div className="mt-4 text-center">
          <EndpointCount />
        </div>

        <footer className="mt-8 text-center">
          <p className="text-xs text-[var(--text-muted)]">
            powered by{" "}
            <a
              href="https://spraay.app"
              className="text-[var(--spraay-blue)] hover:text-[var(--spraay-cyan)]"
            >
              spraay.app
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
