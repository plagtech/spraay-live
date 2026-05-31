import { getAllGatewayStats } from "@/lib/gatewayStats";

// Server component: runs the gateway fetch on the server (ISR-cached 5 min),
// so the inventory count is accurate without shipping the logic to the client.
export default async function EndpointCount() {
  const { perGateway, combined } = await getAllGatewayStats();
  const reachable = perGateway.filter((g) => g.ok);

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <span className="font-semibold text-[var(--text-primary)] tabular-nums">
          {combined.total.toLocaleString()}
        </span>
        <span>endpoints live</span>
        <span className="text-[var(--border-subtle)]">·</span>
        <span className="font-semibold text-[var(--spraay-cyan)] tabular-nums">
          {combined.paid.toLocaleString()}
        </span>
        <span>paid</span>
        <span className="text-[var(--border-subtle)]">·</span>
        <span className="tabular-nums">{reachable.length}</span>
        <span>{reachable.length === 1 ? "gateway" : "gateways"}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]/70 font-mono">
        {perGateway.map((g) => (
          <span key={g.name} className="inline-flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                g.ok ? "bg-[var(--success)]" : "bg-[var(--intent)]"
              }`}
            />
            {g.name} {g.ok ? g.total : "—"}
          </span>
        ))}
      </div>
    </div>
  );
}
