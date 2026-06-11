"use client";

import { useEffect, useState } from "react";
import { useLiveFeed, type FeedEvent, type Counters } from "./useLiveFeed";

// CSS-variable palette — single source of truth stays in globals.css
const V = {
  bg: "var(--bg-primary)",
  elevated: "var(--bg-elevated)",
  panel: "var(--noc-panel)",
  border: "var(--border-subtle)",
  text: "var(--text-primary)",
  muted: "var(--text-muted)",
  dim: "var(--noc-dim)",
  blue: "var(--spraay-blue)",
  cyan: "var(--spraay-cyan)",
  deep: "var(--spraay-deep)",
  green: "var(--success)",
  red: "var(--intent)",
  amber: "var(--noc-amber)",
  violet: "var(--noc-violet)",
};
const MONO = "var(--font-geist-mono), ui-monospace, Menlo, monospace";

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const TYPE_META: Record<FeedEvent["type"], { label: string; color: string }> = {
  scan: { label: "SCAN", color: V.muted },
  quote: { label: "402 QUOTE", color: V.cyan },
  attempt: { label: "PAY ATTEMPT", color: V.amber },
  settle: { label: "SETTLED", color: V.green },
};

// ─── UTC clock ───
function useUTCClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return "—:—:— UTC";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(now.getUTCHours())}:${p(now.getUTCMinutes())}:${p(now.getUTCSeconds())} UTC`;
}

// ─── primitives ───
function Panel({ title, right, children, style }: {
  title: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div className="noc-panel" style={style}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: V.muted, textTransform: "uppercase" }}>
          {title}
        </span>
        {right}
      </div>
      {children}
    </div>
  );
}

function LiveDot({ color = V.green }: { color?: string }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
      <span className="noc-ping" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
      <span style={{ position: "relative", width: 8, height: 8, borderRadius: "50%", background: color }} />
    </span>
  );
}

// ─── funnel counters ───
function NocCounterBar({ counters, series }: { counters: Counters; series: { traffic: number }[] }) {
  const items = [
  { key: "scan" as const, label: "Scans", color: V.muted },
  { key: "quote" as const, label: "Intents", color: V.cyan },
  { key: "settle" as const, label: "Payments", color: V.green },
];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
      {items.map((it, i) => (
        <div key={it.key} style={{
          background: V.elevated, border: `1px solid ${V.border}`, borderRadius: 10,
          padding: "12px 14px", position: "relative", overflow: "hidden",
        }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.5, color: V.muted, textTransform: "uppercase" }}>
            {it.label}
          </div>
          <div key={counters[it.key]} className="noc-tick" style={{
            fontFamily: MONO, fontSize: 26, fontWeight: 600, color: it.color, marginTop: 4,
          }}>
            {counters[it.key].toLocaleString()}
          </div>
          <Sparkline data={series.map((d) => d.traffic * (1 - i * 0.18))} color={it.color} />
          {i < 3 && (
            <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: V.dim, fontSize: 14 }}>›</div>
          )}
        </div>
      ))}
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 140, h = 26;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ marginTop: 8, opacity: 0.7 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ─── traffic area chart ───
function TrafficChart({ series }: { series: { traffic: number; settle: number }[] }) {
  const w = 520, h = 150;
  const max = Math.max(...series.map((d) => d.traffic), 1);
  const path = (key: "traffic" | "settle") => {
    const pts = series.map((d, i) => [(i / (series.length - 1)) * w, h - (d[key] / max) * (h - 14)]);
    let dStr = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const mx = (x0 + x1) / 2;
      dStr += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
    }
    return { line: dStr, area: `${dStr} L ${w} ${h} L 0 ${h} Z` };
  };
  const traffic = path("traffic");
  const settle = path("settle");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id="gTraffic" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B9EFF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3B9EFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gSettle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ADE80" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#4ADE80" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke="#1A2C4E" strokeWidth="0.5" strokeDasharray="3 5" />
      ))}
      <path d={traffic.area} fill="url(#gTraffic)" className="noc-d" />
      <path d={traffic.line} fill="none" stroke={V.blue} strokeWidth="1.8" className="noc-d" />
      <path d={settle.area} fill="url(#gSettle)" className="noc-d" />
      <path d={settle.line} fill="none" stroke={V.green} strokeWidth="1.6" className="noc-d" />
      <circle cx={w - 2} cy={h - (series[series.length - 1].traffic / max) * (h - 14)} r="3.5" fill="#3B9EFF">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ─── chain distribution donut ───
function ChainDonut({ mix }: { mix: { base: number; ethereum: number; solana: number; other: number } }) {
  const segs = [
    { label: "Base", value: mix.base, color: V.blue },
    { label: "Ethereum", value: mix.ethereum, color: V.violet },
    { label: "Solana", value: mix.solana, color: V.cyan },
    { label: "Other", value: mix.other, color: V.deep },
  ];
  const r = 52, circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
        <g transform="rotate(-90 70 70)">
          {segs.map((s) => {
            const len = (s.value / 100) * circ;
            const el = (
              <circle key={s.label} cx="70" cy="70" r={r} fill="none" stroke={s.color}
                strokeWidth="16" strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset}
                style={{ transition: "stroke-dasharray 1.2s ease, stroke-dashoffset 1.2s ease" }} />
            );
            offset += len;
            return el;
          })}
        </g>
        <text x="70" y="66" textAnchor="middle" fill="#F0F4FA" fontFamily="ui-monospace, Menlo, monospace" fontSize="20" fontWeight="600">
          {Math.round(mix.base)}%
        </text>
        <text x="70" y="84" textAnchor="middle" fill="#8BA3C7" fontFamily="ui-monospace, Menlo, monospace" fontSize="9" letterSpacing="1">BASE</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {segs.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: V.muted, width: 70 }}>{s.label}</span>
            <span style={{ color: V.text }}>{Math.round(s.value)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── network flows ───
function NetworkFlows() {
  const nodes = [
    { id: "SF", x: 60, y: 95 }, { id: "NYC", x: 150, y: 80 },
    { id: "LON", x: 250, y: 55 }, { id: "FRA", x: 290, y: 70 },
    { id: "SGP", x: 410, y: 120 }, { id: "TYO", x: 460, y: 75 },
  ];
  const arcs: [string, string][] = [
    ["SF", "NYC"], ["NYC", "LON"], ["LON", "FRA"], ["FRA", "SGP"], ["SGP", "TYO"], ["SF", "TYO"], ["NYC", "SGP"],
  ];
  const get = (id: string) => nodes.find((n) => n.id === id)!;
  return (
    <svg width="100%" viewBox="0 0 520 160" style={{ display: "block" }}>
      <defs>
        <radialGradient id="nodeGlow">
          <stop offset="0%" stopColor="#4DB8FF" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#4DB8FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      {Array.from({ length: 13 }).map((_, gx) =>
        Array.from({ length: 4 }).map((__, gy) => (
          <circle key={`${gx}-${gy}`} cx={20 + gx * 40} cy={20 + gy * 40} r="1" fill="#1A2C4E" />
        ))
      )}
      {arcs.map(([a, b], i) => {
        const A = get(a), B = get(b);
        const mx = (A.x + B.x) / 2;
        const my = Math.min(A.y, B.y) - 35 - (Math.abs(A.x - B.x) > 200 ? 25 : 0);
        const d = `M ${A.x} ${A.y} Q ${mx} ${my} ${B.x} ${B.y}`;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="#1A2C4E" strokeWidth="1" />
            <path d={d} fill="none" stroke="#3B9EFF" strokeWidth="1.2" strokeDasharray="6 90"
              className="noc-dash" style={{ animationDuration: `${(2.5 + i * 0.4).toFixed(1)}s`, animationDelay: `${(i * 0.7).toFixed(1)}s` }} />
            <circle r="2.5" fill="#4DB8FF">
              <animateMotion dur={`${(3 + i * 0.6).toFixed(1)}s`} repeatCount="indefinite" path={d} />
            </circle>
          </g>
        );
      })}
      {nodes.map((n) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r="12" fill="url(#nodeGlow)" opacity="0.5" />
          <circle cx={n.x} cy={n.y} r="3.5" fill="#050914" stroke="#4DB8FF" strokeWidth="1.5" />
          <text x={n.x} y={n.y + 18} textAnchor="middle" fill="#8BA3C7" fontFamily="ui-monospace, Menlo, monospace" fontSize="9" letterSpacing="1">{n.id}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── latency bars ───
function LatencyBars({ latency }: { latency: number[] }) {
  const max = 3;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 70 }}>
      {latency.map((v, i) => (
        <div key={i} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }}>
          <div style={{
            width: "100%", borderRadius: 3,
            height: `${Math.max(4, (v / max) * 100)}%`,
            background: v > 2 ? V.amber : `linear-gradient(180deg, ${V.cyan}, ${V.blue})`,
            transition: "height 1.2s ease, background .4s",
            boxShadow: i === latency.length - 1 ? "0 0 8px rgba(59,158,255,.4)" : "none",
          }} />
        </div>
      ))}
    </div>
  );
}

// ─── live stream ───
function LiveStream({ events }: { events: FeedEvent[] }) {
  return (
    <div style={{ overflow: "hidden", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {events.length === 0 && (
        <span style={{ fontFamily: MONO, fontSize: 11, color: V.dim }}>waiting for gateway events…</span>
      )}
      {events.map((ev) => {
        const meta = TYPE_META[ev.type];
        const p = (n: number) => String(n).padStart(2, "0");
        return (
          <div key={ev.id}
            className={ev.type === "settle" ? "event-row noc-glow" : "event-row"}
            style={{
              fontFamily: MONO, fontSize: 10.5, lineHeight: 1.9, whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis",
              borderLeft: `2px solid ${meta.color}`, paddingLeft: 8, marginBottom: 2,
            }}>
            <span style={{ color: V.dim }}>
              {p(ev.ts.getUTCHours())}:{p(ev.ts.getUTCMinutes())}:{p(ev.ts.getUTCSeconds())}
            </span>{" "}
            <span style={{ color: meta.color, fontWeight: 600 }}>[{meta.label}]</span>{" "}
            <span style={{ color: V.text }}>{ev.endpoint}</span>{" "}
            <span style={{ color: V.dim }}>·</span>{" "}
            <span style={{ color: V.muted }}>{ev.chain}</span>
            {ev.amount && (
              <>
                {" "}<span style={{ color: V.dim }}>·</span>{" "}
                <span style={{ color: ev.type === "settle" ? V.green : V.amber }}>{ev.amount} USDC</span>
              </>
            )}
            {" "}<span style={{ color: V.dim }}>{ev.agent}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── main export ───
export default function NocDashboard() {
  const clock = useUTCClock();
  const { counters, events, series, latency, chainMix, live } = useLiveFeed();
  const settleRate = ((counters.settle / Math.max(counters.quote, 1)) * 100).toFixed(1);
  const lastLatency = latency[latency.length - 1] ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* header strip */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap",
        gap: 10, borderBottom: `1px solid ${V.border}`, paddingBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>💧</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 650, letterSpacing: -0.2, color: V.text }}>
              Spraay Live <span style={{ color: V.muted, fontWeight: 400 }}>· x402 Gateway Ops</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: V.dim, letterSpacing: 1.5 }}>
              151 PAID · 6 FREE · 39 CATEGORIES · v3.8.1
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontFamily: MONO, fontSize: 13, color: V.muted }} suppressHydrationWarning>{clock}</span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 7, fontFamily: MONO, fontSize: 11,
            color: V.green, border: "1px solid rgba(74,222,128,.27)", borderRadius: 99,
            padding: "4px 12px", background: "rgba(74,222,128,.05)", letterSpacing: 1.5,
          }}>
            <LiveDot /> {live ? "LIVE" : "DEMO"}
          </span>
        </div>
      </div>

      <NocCounterBar counters={counters} series={series} />

      <div className="noc-grid">
        {/* left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <Panel title="Gateway Traffic" right={
            <div style={{ display: "flex", gap: 12, fontFamily: MONO, fontSize: 9.5 }}>
              <span style={{ color: V.blue }}>● requests</span>
              <span style={{ color: V.green }}>● settlements</span>
            </div>
          }>
            <TrafficChart series={series} />
          </Panel>
          <Panel title="Network Flows" right={<span style={{ fontFamily: MONO, fontSize: 9.5, color: V.dim }}>agent → recipient</span>}>
            <NetworkFlows />
          </Panel>
        </div>

        {/* center */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <Panel title="Chain Distribution">
            <ChainDonut mix={chainMix} />
          </Panel>
          <Panel title="Settlement Latency" right={<span style={{ fontFamily: MONO, fontSize: 9.5, color: V.dim }}>seconds / window</span>}>
            <LatencyBars latency={latency} />
          </Panel>
          <Panel title="Funnel Health">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { l: "Quote → Settle", v: `${settleRate}%`, c: V.green },
                { l: "Avg settle", v: `${lastLatency.toFixed(2)}s`, c: V.cyan },
                { l: "Active chains", v: "15", c: V.blue },
                { l: "Open attempts", v: String(Math.max(0, counters.attempt - counters.settle)), c: V.red },
              ].map((m) => (
                <div key={m.l} style={{ background: V.elevated, border: `1px solid ${V.border}`, borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: V.muted, letterSpacing: 1, textTransform: "uppercase" }}>{m.l}</div>
                  <div style={{ fontFamily: MONO, fontSize: 17, color: m.c, fontWeight: 600, marginTop: 2 }}>{m.v}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* right */}
        <Panel title="Live Data Stream" right={<LiveDot color={V.cyan} />} style={{ maxHeight: 540, overflow: "hidden" }}>
          <LiveStream events={events} />
        </Panel>
      </div>
    </div>
  );
}
