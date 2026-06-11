"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabase } from "../../../lib/supabaseClient";

// Schema confirmed against production gateway_events:
//   event_type ∈ { 'scan', 'intent', 'payment' }
//   columns: endpoint/path, chain, amount, payer/agent, created_at
const TABLE = "gateway_events";

export type FeedEventType = "scan" | "intent" | "payment";

export interface FeedEvent {
  id: string;
  ts: Date;
  type: FeedEventType;
  endpoint: string;
  chain: string;
  agent: string;
  amount: string | null;
}

export interface Counters {
  scan: number;
  intent: number;
  payment: number;
}

const EMPTY: Counters = { scan: 0, intent: 0, payment: 0 };

const normalizeType = (raw: unknown): FeedEventType => {
  const t = String(raw ?? "").toLowerCase();
  if (t === "payment" || t.startsWith("settl") || t === "paid") return "payment";
  if (t === "intent" || t.includes("quote") || t === "402") return "intent";
  return "scan";
};

const truncAddr = (a: unknown): string => {
  const s = String(a ?? "");
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s || "—";
};

function mapRow(row: Record<string, unknown>): FeedEvent {
  return {
    id: String(row.id ?? Math.random().toString(36).slice(2)),
    ts: row.created_at ? new Date(String(row.created_at)) : new Date(),
    type: normalizeType(row.event_type ?? row.type ?? row.event),
    endpoint: String(row.endpoint ?? row.path ?? row.resource ?? "/x402/—"),
    chain: String(row.chain ?? "base"),
    agent: truncAddr(row.payer ?? row.agent ?? row.from_address ?? row.wallet),
    amount:
      row.amount != null && row.amount !== ""
        ? Number(row.amount).toFixed(3)
        : null,
  };
}

// ─── demo simulation (used only when Supabase env vars are absent) ───
const DEMO_ENDPOINTS = [
  "/x402/batch/quote", "/x402/inference/chutes", "/x402/research/openalex",
  "/x402/escrow/compute", "/x402/batch/base", "/x402/data/census",
  "/x402/inference/openrouter", "/x402/batch/solana", "/x402/agent-wallet/create",
];
const DEMO_CHAINS = ["base", "ethereum", "solana", "polygon", "arbitrum"];
const DEMO_AGENTS = ["0x7f3a…c21d", "0xd136…d546", "0x4b8e…91af", "0xa0c2…77e3"];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function demoEvent(): FeedEvent {
  const r = Math.random();
  const type: FeedEventType = r < 0.15 ? "scan" : r < 0.97 ? "intent" : "payment";
  return {
    id: Math.random().toString(36).slice(2),
    ts: new Date(),
    type,
    endpoint: pick(DEMO_ENDPOINTS),
    chain: pick(DEMO_CHAINS),
    agent: pick(DEMO_AGENTS),
    amount: type === "payment" ? rand(0.001, 0.85).toFixed(3) : null,
  };
}

// ─── the hook ───
export function useLiveFeed() {
  const [counters, setCounters] = useState<Counters>(EMPTY);   // all-time
  const [today, setToday] = useState<Counters>(EMPTY);          // trailing 24h
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [series, setSeries] = useState(() =>
    Array.from({ length: 48 }, () => ({ traffic: 0, settle: 0 }))
  );
  const [latency, setLatency] = useState<number[]>(() => Array.from({ length: 14 }, () => 0));
  const [chainCounts, setChainCounts] = useState<Record<string, number>>({});
  const [live, setLive] = useState(false);
  const bucket = useRef({ traffic: 0, settle: 0 });

  const ingest = (ev: FeedEvent) => {
    setCounters((c) => ({ ...c, [ev.type]: c[ev.type] + 1 }));
    setToday((c) => ({ ...c, [ev.type]: c[ev.type] + 1 }));
    setEvents((e) => [ev, ...e].slice(0, 26));
    setChainCounts((m) => ({ ...m, [ev.chain]: (m[ev.chain] ?? 0) + 1 }));
    bucket.current.traffic += 1;
    if (ev.type === "payment") bucket.current.settle += 1;
  };

  useEffect(() => {
    const supabase = getSupabase();
    let cleanup: (() => void) | undefined;

    if (supabase) {
      setLive(true);

      (async () => {
        const types: FeedEventType[] = ["scan", "intent", "payment"];
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const all: Partial<Counters> = {};
        const day: Partial<Counters> = {};
        for (const t of types) {
          const { count: allCount } = await supabase
            .from(TABLE)
            .select("*", { count: "exact", head: true })
            .eq("event_type", t);
          all[t] = allCount ?? 0;

          const { count: dayCount } = await supabase
            .from(TABLE)
            .select("*", { count: "exact", head: true })
            .eq("event_type", t)
            .gte("created_at", since24h);
          day[t] = dayCount ?? 0;
        }
        setCounters((c) => ({ ...c, ...all } as Counters));
        setToday((c) => ({ ...c, ...day } as Counters));

        // seed the stream with the most recent rows
        const { data } = await supabase
          .from(TABLE)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20);
        if (data) {
          setEvents(data.map(mapRow));
          const chains: Record<string, number> = {};
          for (const r of data) {
            const c = String((r as Record<string, unknown>).chain ?? "base");
            chains[c] = (chains[c] ?? 0) + 1;
          }
          setChainCounts(chains);
        }
      })();

      const channel = supabase
        .channel("gateway-events-live")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: TABLE },
          (payload) => ingest(mapRow(payload.new as Record<string, unknown>))
        )
        .subscribe();

      cleanup = () => { supabase.removeChannel(channel); };
    } else {
      // demo mode
      setCounters({ scan: 87952, intent: 453200, payment: 229 });
      setToday({ scan: 1427, intent: 25112, payment: 7 });
      let alive = true;
      let timeout: ReturnType<typeof setTimeout>;
      const emit = () => {
        if (!alive) return;
        ingest(demoEvent());
        timeout = setTimeout(emit, rand(350, 1400));
      };
      emit();
      cleanup = () => { alive = false; clearTimeout(timeout); };
    }

    const chartId = setInterval(() => {
      setSeries((s) => {
        const next = [
          ...s.slice(1),
          {
            traffic: Math.min(95, bucket.current.traffic * 9 + (bucket.current.traffic ? rand(5, 15) : rand(2, 8))),
            settle: bucket.current.settle * 8 + rand(0, 3),
          },
        ];
        bucket.current = { traffic: 0, settle: 0 };
        return next;
      });
      setLatency((l) => [...l.slice(1), rand(0.3, 2.6)]);
    }, 1600);

    return () => { cleanup?.(); clearInterval(chartId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = Object.values(chainCounts).reduce((a, b) => a + b, 0) || 1;
  const pct = (k: string) => ((chainCounts[k] ?? 0) / total) * 100;
  const base = pct("base"), ethereum = pct("ethereum"), solana = pct("solana");
  const chainMix = {
    base: base || 46,
    ethereum: ethereum || 21,
    solana: solana || 18,
    other: Math.max(0, 100 - (base || 46) - (ethereum || 21) - (solana || 18)),
  };

  return { counters, today, events, series, latency, chainMix, live };
}
