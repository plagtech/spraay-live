'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type Counts = {
  scans: number;
  quotes: number;
  attempts: number;
  settlements: number;
};

function AnimNum({ value, loading }: { value: number; loading: boolean }) {
  const [display, setDisplay] = useState(0);
  const [flash, setFlash] = useState(false);
  const prev = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    if (loading) return;
    const from = prev.current;
    const to = value;
    if (to > from && from > 0) {
      setFlash(true);
      setTimeout(() => setFlash(false), 500);
    }
    if (to === from) return;

    const dur = from === 0 ? 1800 : 350;
    const start = performance.now();
    function tick(now: number) {
      const p = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * e));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    prev.current = to;
    return () => cancelAnimationFrame(raf.current);
  }, [value, loading]);

  if (loading) return <span className="text-lg font-bold tabular-nums text-slate-600">—</span>;

  return (
    <span className={`text-lg font-bold tabular-nums transition-colors duration-300 ${flash ? 'num-flash' : ''}`}>
      {display.toLocaleString()}
    </span>
  );
}

const METRICS = [
  { key: 'scans' as const, label: 'Scans', color: 'text-slate-200' },
  { key: 'quotes' as const, label: 'Quotes', color: 'text-sky-300' },
  { key: 'attempts' as const, label: 'Attempts', color: 'text-amber-300' },
  { key: 'settlements' as const, label: 'Settled', color: 'text-emerald-300' },
];

export default function CompactStats() {
  const [counts, setCounts] = useState<Counts>({ scans: 0, quotes: 0, attempts: 0, settlements: 0 });
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [scanRes, quoteRes, attemptRes, settlementRes] = await Promise.all([
      supabase.from('gateway_events_public').select('*', { count: 'exact', head: true }).eq('event_type', 'scan').gte('created_at', since),
      supabase.from('gateway_events_public').select('*', { count: 'exact', head: true }).eq('event_type', 'intent').eq('payment_attempted', false).gte('created_at', since),
      supabase.from('gateway_events_public').select('*', { count: 'exact', head: true }).eq('payment_attempted', true).gte('created_at', since),
      supabase.from('gateway_events_public').select('*', { count: 'exact', head: true }).eq('event_type', 'payment').gte('created_at', since),
    ]);
    setCounts({
      scans: scanRes.count ?? 0,
      quotes: quoteRes.count ?? 0,
      attempts: attemptRes.count ?? 0,
      settlements: settlementRes.count ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    const channel = supabase
      .channel('counter-compact')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gateway_events' }, () => fetchCounts())
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [fetchCounts]);

  return (
    <div className="flex items-center justify-center gap-6 py-3 px-4 bg-slate-900/70 backdrop-blur-sm border-y border-slate-800/60">
      {METRICS.map((m) => (
        <div key={m.key} className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 hidden sm:inline">{m.label}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 sm:hidden">{m.label.charAt(0)}</span>
          <span className={m.color}>
            <AnimNum value={counts[m.key]} loading={loading} />
          </span>
        </div>
      ))}
      <span className="text-[10px] text-slate-600 hidden md:inline">24h</span>
    </div>
  );
}
