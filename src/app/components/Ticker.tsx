"use client";

import { useEffect, useState, useRef } from "react";
import { supabase, type GatewayEvent } from "@/lib/supabase";

const MAX_EVENTS = 40;

const CATEGORY_LABELS: Record<string, string> = {
  ai_inference: "AI Inference",
  oracle: "Oracle",
  escrow: "Escrow",
  payroll: "Payroll",
  bridge: "Bridge",
  swap: "Swap",
  xrp: "XRP",
  stellar: "Stellar",
  batch_payment: "Batch Payment",
  rtp: "RTP",
  agent_wallet: "Agent Wallet",
  wallet: "Wallet",
  search: "Search",
  storage: "Storage",
  cron: "Cron",
  kyc: "KYC",
  auth: "Auth",
  audit: "Audit",
  tax: "Tax",
  gpu: "GPU",
  webhook: "Webhook",
  communication: "Communication",
  rpc: "RPC",
  sctp: "SCTP",
  bittensor_dropin: "Bittensor",
  invoice: "Invoice",
  analytics: "Analytics",
  balances: "Balances",
  resolve: "Resolve",
};

const CHAIN_LABELS: Record<string, string> = {
  base: "Base",
  solana: "Solana",
  xrp: "XRP",
  stellar: "Stellar",
  bitcoin: "Bitcoin",
  stacks: "Stacks",
  polygon: "Polygon",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
};

type DisplayType = "scan" | "quote" | "attempt" | "settled";

function classifyDisplay(event: GatewayEvent): DisplayType {
  if (event.event_type === "scan") return "scan";
  if (event.event_type === "payment") return "settled";
  if (event.payment_attempted) return "attempt";
  return "quote";
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function EventBadge({ type }: { type: DisplayType }) {
  const styles = {
    scan: "bg-[var(--spraay-deep)] text-[var(--text-muted)] border-[var(--border-subtle)]",
    quote: "bg-sky-950/40 text-sky-300 border-sky-900/40",
    attempt: "bg-amber-950/40 text-amber-300 border-amber-900/40",
    settled: "bg-[var(--spraay-blue)]/15 text-[var(--spraay-cyan)] border-[var(--spraay-blue)]/30",
  };
  const labels = { scan: "SCAN", quote: "QUOTE", attempt: "ATTEMPT", settled: "SETTLED" };
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${styles[type]} tracking-wider`}
    >
      {labels[type]}
    </span>
  );
}

function EventRow({ event }: { event: GatewayEvent }) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const displayType = classifyDisplay(event);
  const rowClass = displayType === "settled" ? "event-row-payment" : "event-row";
  const categoryLabel = event.category ? CATEGORY_LABELS[event.category] ?? event.category : null;
  const chainLabel = event.chain ? CHAIN_LABELS[event.chain] ?? event.chain : null;

  return (
    <div
      className={`${rowClass} flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)]/40 hover:bg-[var(--bg-elevated)]/60 transition-colors`}
    >
      <EventBadge type={displayType} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {categoryLabel && (
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {categoryLabel}
            </span>
          )}
          {chainLabel && (
            <span className="text-[11px] text-[var(--spraay-blue)] bg-[var(--spraay-deep)]/40 px-1.5 py-0.5 rounded">
              {chainLabel}
            </span>
          )}
          {event.batch_size && event.batch_size > 1 && (
            <span className="text-[11px] font-semibold text-[var(--spraay-cyan)]">
              BATCH × {event.batch_size}
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5 font-mono truncate">
          {event.path}
          {event.payer_truncated && (
            <span className="ml-2 text-[var(--spraay-blue)]">
              {event.payer_truncated}
            </span>
          )}
          {event.scanner_source && (
            <span className="ml-2 text-[var(--text-muted)] italic">
              via {event.scanner_source}
            </span>
          )}
        </div>
      </div>

      <div className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">
        {timeAgo(event.created_at)}
      </div>
    </div>
  );
}

export default function Ticker() {
  const [events, setEvents] = useState<GatewayEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      const { data, error } = await supabase
        .from("gateway_events_public")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(MAX_EVENTS);

      if (cancelled) return;
      if (error) {
        console.error("[ticker] initial load failed:", error);
        return;
      }
      if (data) {
        setEvents(data);
        data.forEach((e) => seenIds.current.add(e.id));
      }
    }

    loadInitial();

    const channel = supabase
      .channel("gateway-events-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gateway_events" },
        async (payload) => {
          const newRow = payload.new as { id: string };
          if (seenIds.current.has(newRow.id)) return;

          const { data, error } = await supabase
            .from("gateway_events_public")
            .select("*")
            .eq("id", newRow.id)
            .maybeSingle();

          if (error || !data) return;

          seenIds.current.add(data.id);
          setEvents((prev) => [data, ...prev].slice(0, MAX_EVENTS));
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3 px-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-[var(--success)] live-dot" : "bg-[var(--text-muted)]"
            }`}
          />
          <span className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider">
            {connected ? "live" : "connecting..."}
          </span>
        </div>
        <span className="text-xs text-[var(--text-muted)] font-mono">
          gateway.spraay.app
        </span>
      </div>

      <div className="bg-[var(--bg-elevated)]/40 border border-[var(--border-subtle)] rounded-lg overflow-hidden">
        {events.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm">
            waiting for agent activity...
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}