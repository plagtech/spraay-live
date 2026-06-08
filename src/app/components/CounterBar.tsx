'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type Counts = {
  scans: number;
  quotes: number;
  attempts: number;
  settlements: number;
};

/* ── Animated number that counts up with easing ────────── */

function AnimatedNumber({
  value,
  color,
  loading,
}: {
  value: number;
  color: string;
  loading: boolean;
}) {
  const [display, setDisplay] = useState(0);
  const [flashing, setFlashing] = useState(false);
  const prevValue = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (loading) return;

    const from = prevValue.current;
    const to = value;
    const isIncrement = to > from && from > 0;

    // Flash on live increment
    if (isIncrement) {
      setFlashing(true);
      const timer = setTimeout(() => setFlashing(false), 600);
      // Quick jump for small increments
      if (to - from <= 3) {
        setDisplay(to);
        prevValue.current = to;
        return () => clearTimeout(timer);
      }
    }

    // Animate count-up
    const duration = from === 0 ? 2000 : 400; // slow on first load, fast on updates
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    prevValue.current = to;

    return () => cancelAnimationFrame(rafRef.current);
  }, [value, loading]);

  if (loading) {
    return <span className="text-2xl font-bold tabular-nums text-slate-600">—</span>;
  }

  return (
    <span
      className={`text-2xl font-bold tabular-nums transition-colors duration-300 ${flashing ? 'num-flash' : ''}`}
      style={{ color }}
    >
      {display.toLocaleString()}
    </span>
  );
}

/* ── Counter bar ───────────────────────────────────────── */

const CARDS = [
  { key: 'scans' as const, label: 'Scans (24h)', sub: 'Manifest lookups', color: '#E2E8F0', delay: 'fade-up-1' },
  { key: 'quotes' as const, label: 'Quotes (24h)', sub: 'Priced endpoints browsed', color: '#7DD3FC', delay: 'fade-up-2' },
  { key: 'attempts' as const, label: 'Attempts (24h)', sub: 'Payment signatures submitted', color: '#FCD34D', delay: 'fade-up-3' },
  { key: 'settlements' as const, label: 'Settled (24h)', sub: 'Confirmed on-chain', color: '#4ADE80', delay: 'fade-up-4' },
];

export default function CounterBar() {
  const [counts, setCounts] = useState<Counts>({ scans: 0, quotes: 0, attempts: 0, settlements: 0 });
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [scanRes, quoteRes, attemptRes, settlementRes] = await Promise.all([
      supabase
        .from('gateway_events_public')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'scan')
        .gte('created_at', since),
      supabase
        .from('gateway_events_public')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'intent')
        .eq('payment_attempted', false)
        .gte('created_at', since),
      supabase
        .from('gateway_events_public')
        .select('*', { count: 'exact', head: true })
        .eq('payment_attempted', true)
        .gte('created_at', since),
      supabase
        .from('gateway_events_public')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'payment')
        .gte('created_at', since),
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
      .channel('counter-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gateway_events' },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchCounts]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 max-w-3xl mx-auto">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className={`counter-card fade-up ${card.delay} bg-slate-900/60 border border-slate-800 rounded-lg p-4`}
        >
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
            {card.label}
          </div>
          <AnimatedNumber
            value={counts[card.key]}
            color={card.color}
            loading={loading}
          />
          <div className="text-xs text-slate-600 mt-2">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}
