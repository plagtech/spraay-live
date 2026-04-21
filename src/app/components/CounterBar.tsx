'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Counts = {
  scans: number;
  quotes: number;
  attempts: number;
  settlements: number;
};

export default function CounterBar() {
  const [counts, setCounts] = useState<Counts>({ scans: 0, quotes: 0, attempts: 0, settlements: 0 });
  const [loading, setLoading] = useState(true);

  async function fetchCounts() {
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
  }

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
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 max-w-3xl mx-auto">
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Scans (24h)</div>
        <div className="text-2xl font-bold text-slate-100 tabular-nums">
          {loading ? '—' : counts.scans.toLocaleString()}
        </div>
        <div className="text-xs text-slate-600 mt-2">Manifest lookups</div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Quotes (24h)</div>
        <div className="text-2xl font-bold text-sky-300 tabular-nums">
          {loading ? '—' : counts.quotes.toLocaleString()}
        </div>
        <div className="text-xs text-slate-600 mt-2">Priced endpoints browsed</div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Attempts (24h)</div>
        <div className="text-2xl font-bold text-amber-300 tabular-nums">
          {loading ? '—' : counts.attempts.toLocaleString()}
        </div>
        <div className="text-xs text-slate-600 mt-2">Payment signatures submitted</div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Settled (24h)</div>
        <div className="text-2xl font-bold text-emerald-300 tabular-nums">
          {loading ? '—' : counts.settlements.toLocaleString()}
        </div>
        <div className="text-xs text-slate-600 mt-2">Confirmed on-chain</div>
      </div>
    </div>
  );
}