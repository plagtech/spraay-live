// Counts live endpoints across every Spraay gateway by reading each
// gateway's own discovery manifest at request time. Because it counts the
// real route keys (not the self-reported `totalEndpoints` field, which drifts),
// the dashboard stays accurate automatically as new endpoints ship.

type GatewayShape = "nested" | "flat";

type GatewayConfig = {
  name: string;
  url: string;
  shape: GatewayShape;
};

const GATEWAYS: GatewayConfig[] = [
  // Root endpoints return the full manifest with the route map.
  { name: "Main", url: "https://gateway.spraay.app/", shape: "nested" },
  { name: "Solana", url: "https://gateway-solana.spraay.app/", shape: "flat" },
];

const stripMethod = (s: string) =>
  s.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/i, "").trim();

type RouteSets = { free: Set<string>; paid: Set<string> };

// Main gateway: { endpoints: { free: {"GET /x": "label"}, paid: {...} } }
function parseNested(data: any): RouteSets {
  const free = new Set(
    Object.keys(data?.endpoints?.free ?? {}).map(stripMethod)
  );
  // A route offered for free is never also counted as paid (drops the
  // gpu/models entry that appears in both blocks on the main gateway).
  const paid = new Set(
    Object.keys(data?.endpoints?.paid ?? {})
      .map(stripMethod)
      .filter((r) => !free.has(r))
  );
  return { free, paid };
}

// Solana gateway: { endpoints: { friendlyName: "POST /x ($0.01)" | "GET /x (free)" } }
function parseFlat(data: any): RouteSets {
  const free = new Set<string>();
  const paid = new Set<string>();
  for (const value of Object.values<string>(data?.endpoints ?? {})) {
    const route = stripMethod(value.replace(/\s*\(.*\)\s*$/, ""));
    const isFree = /\(free\)/i.test(value) || !value.includes("$");
    (isFree ? free : paid).add(route);
  }
  return { free, paid };
}

const PARSERS: Record<GatewayShape, (data: any) => RouteSets> = {
  nested: parseNested,
  flat: parseFlat,
};

export type GatewayStat = {
  name: string;
  free: number;
  paid: number;
  total: number;
  ok: boolean; // false if the gateway was unreachable this fetch
};

export type GatewayStats = {
  perGateway: GatewayStat[];
  combined: { free: number; paid: number; total: number };
};

export async function getAllGatewayStats(): Promise<GatewayStats> {
  const perGateway = await Promise.all(
    GATEWAYS.map(async (gw): Promise<GatewayStat> => {
      try {
        const res = await fetch(gw.url, { next: { revalidate: 300 } }); // cache 5 min
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { free, paid } = PARSERS[gw.shape](await res.json());
        return {
          name: gw.name,
          free: free.size,
          paid: paid.size,
          total: free.size + paid.size,
          ok: true,
        };
      } catch {
        // Degrade gracefully — one gateway down shouldn't blank the count.
        return { name: gw.name, free: 0, paid: 0, total: 0, ok: false };
      }
    })
  );

  // Sum per-gateway sizes rather than unioning into one global set, so a route
  // is counted once per host (two gateways sharing a path = two real endpoints).
  const combined = perGateway.reduce(
    (acc, g) => ({
      free: acc.free + g.free,
      paid: acc.paid + g.paid,
      total: acc.total + g.total,
    }),
    { free: 0, paid: 0, total: 0 }
  );

  return { perGateway, combined };
}
