'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Counts = {
  scan: number;
  intent: number;
  payment: number;
};

export default function CounterBar() {
  const [counts, setCounts] = useState<Counts>({ scan: 0, intent: 0, payment: 0 });
  const [loading, setLoading] = useState(true);

  async function fetchCounts() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [scanRes, intentRes, paymentRes] = await Promise.all([
      supabase
        .from('gateway_events_public')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'scan')
        .gte('created_at', since),
      supabase
        .from('gateway_events_public')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'intent')
        .gte('created_at', since),
      supabase
        .from('gateway_events_public')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'payment')
        .gte('created_at', since),
    ]);

    setCounts({
      scan: scanRes.count ?? 0,
      intent: intentRes.count ?? 0,
      payment: paymentRes.count ?? 0,
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

  const intentRate = counts.scan > 0 ? ((counts.intent / counts.scan) * 100).toFixed(1) : '0.0';
  const paymentRate = counts.intent > 0 ? ((counts.payment / counts.intent) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 max-w-3xl mx-auto">
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Scans (24h)</div>
        <div className="text-3xl font-bold text-slate-100 tabular-nums">
          {loading ? '—' : counts.scan.toLocaleString()}
        </div>
        <div className="text-xs text-slate-600 mt-2">Bots discovering endpoints</div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider text-slate-500">Intents (24h)</div>
          <div className="text-xs text-sky-400 tabular-nums">{intentRate}%</div>
        </div>
        <div className="text-3xl font-bold text-sky-300 tabular-nums">
          {loading ? '—' : counts.intent.toLocaleString()}
        </div>
        <div className="text-xs text-slate-600 mt-2">Agents requesting quotes</div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider text-slate-500">Paid (24h)</div>
          <div className="text-xs text-emerald-400 tabular-nums">{paymentRate}%</div>
        </div>
        <div className="text-3xl font-bold text-emerald-300 tabular-nums">
          {loading ? '—' : counts.payment.toLocaleString()}
        </div>
        <div className="text-xs text-slate-600 mt-2">Settled x402 transactions</div>
      </div>
    </div>
  );
}