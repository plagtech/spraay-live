// Endpoint counts for the main gateway, read from its root response.
//
// `totalEndpoints` is computed by the gateway from its own route registry
// (paid routes + free endpoints), so it is the authoritative total. The
// `endpoints.paid` map in the same response is a hand-written listing and can
// lag behind the registry, so it is only used as a fallback.
type RootResponse = {
  totalEndpoints?: unknown;
  endpoints?: { paid?: Record<string, unknown>; free?: Record<string, unknown> };
};

export function countMainGateway(data: unknown): { paid: number; free: number } {
  const d = (data ?? {}) as RootResponse;
  const free = Object.keys(d.endpoints?.free ?? {}).length;
  const listedPaid = Object.keys(d.endpoints?.paid ?? {}).length;
  const total = Number(d.totalEndpoints);
  const paid = Number.isInteger(total) && total > free ? total - free : listedPaid;
  return { paid, free };
}
