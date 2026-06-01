"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { supabase, type GatewayEvent } from "@/lib/supabase";

// Notional hub coordinates per chain — used only to place glowing nodes on the
// globe. Chains your gateway doesn't tag (or null, e.g. manifest scans) fall back
// to Base.
const CHAINS: Record<string, { lat: number; lon: number }> = {
  base: { lat: 37.8, lon: -122.4 }, solana: { lat: 40.7, lon: -74 },
  ethereum: { lat: 51.5, lon: -0.12 }, xrp: { lat: 1.35, lon: 103.8 },
  stellar: { lat: -33.9, lon: 151.2 }, bitcoin: { lat: 35.7, lon: 139.7 },
  polygon: { lat: 19.0, lon: 72.8 }, arbitrum: { lat: 25.2, lon: 55.3 },
  stacks: { lat: 64.1, lon: -21.9 }, optimism: { lat: 48.85, lon: 2.35 },
  bnb: { lat: 1.29, lon: 103.85 }, avalanche: { lat: -23.5, lon: -46.6 },
};
const CHAIN_KEYS = Object.keys(CHAINS);

type Tier = "scan" | "quote" | "attempt" | "settled";
const TIER_COLOR: Record<Tier, number> = { scan: 0x8ba3c7, quote: 0x4db8ff, attempt: 0xf59e0b, settled: 0x4ade80 };

// Same tier logic Ticker.tsx uses.
function classify(e: Pick<GatewayEvent, "event_type" | "payment_attempted">): Tier {
  if (e.event_type === "payment") return "settled";
  if (e.payment_attempted) return "attempt";
  if (e.event_type === "scan") return "scan";
  return "quote";
}

export default function GatewayGlobe() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.2, 5.0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    wrap.appendChild(renderer.domElement);

    const R = 1;
    const globe = new THREE.Group();
    scene.add(globe);

    // atmosphere haze
    ([[1.18, 0.1], [1.06, 0.16]] as const).forEach(([r, op]) => {
      globe.add(new THREE.Mesh(
        new THREE.SphereGeometry(r, 40, 40),
        new THREE.MeshBasicMaterial({ color: 0x3b9eff, transparent: true, opacity: op, side: THREE.BackSide, blending: THREE.AdditiveBlending })
      ));
    });
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.96, 48, 48), new THREE.MeshBasicMaterial({ color: 0x070d1c })));

    // dotted surface
    const dotPos: number[] = [];
    const N = 1700, inc = Math.PI * (3 - Math.sqrt(5)), off = 2 / N;
    for (let i = 0; i < N; i++) {
      const y = i * off - 1 + off / 2, rr = Math.sqrt(1 - y * y), p = i * inc;
      dotPos.push(Math.cos(p) * rr * R, y * R, Math.sin(p) * rr * R);
    }
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(dotPos, 3));
    globe.add(new THREE.Points(dotGeo, new THREE.PointsMaterial({ color: 0x213a63, size: 0.02, sizeAttenuation: true })));

    const latLon = (lat: number, lon: number, r: number) => {
      const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
      return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
    };

    // hubs
    const hubs: Record<string, { pos: THREE.Vector3; mesh: THREE.Mesh; pulse: number }> = {};
    for (const k of CHAIN_KEYS) {
      const v = latLon(CHAINS[k].lat, CHAINS[k].lon, R * 1.01);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 12), new THREE.MeshBasicMaterial({ color: 0x4db8ff }));
      mesh.position.copy(v);
      globe.add(mesh);
      hubs[k] = { pos: v, mesh, pulse: 0 };
    }

    type Fx = { curve: THREE.QuadraticBezierCurve3; tube: THREE.Mesh; head: THREE.Mesh; ring: THREE.Mesh; age: number; life: number; settled: boolean };
    const fx: Fx[] = [];

    function spawnArc(chainKey: string, tier: Tier) {
      if (fx.length > 70) return; // guard against bursts
      const hub = hubs[chainKey] || hubs.base;
      const dest = hub.pos.clone();
      hub.pulse = 1;
      const oc = CHAINS[CHAIN_KEYS[Math.floor(Math.random() * CHAIN_KEYS.length)]];
      const origin = latLon(oc.lat + (Math.random() * 16 - 8), oc.lon + (Math.random() * 16 - 8), R * 1.01);
      const mid = origin.clone().add(dest).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.5);
      const curve = new THREE.QuadraticBezierCurve3(origin, mid, dest);
      const col = TIER_COLOR[tier];
      const settled = tier === "settled", attempt = tier === "attempt";
      const radius = settled ? 0.013 : attempt ? 0.009 : 0.0065;
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 44, radius, 6, false),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending })
      );
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(settled ? 0.028 : 0.02, 10, 10),
        new THREE.MeshBasicMaterial({ color: col, blending: THREE.AdditiveBlending })
      );
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.02, 0.032, 32),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
      );
      ring.position.copy(dest);
      ring.lookAt(dest.clone().multiplyScalar(2));
      globe.add(tube, head, ring);
      fx.push({ curve, tube, head, ring, age: 0, life: settled ? 3.0 : attempt ? 2.1 : 1.8, settled });
    }

    // ---- Live intake: mirror Ticker.tsx exactly — use the realtime INSERT only
    // as a trigger, then re-fetch the row from the gateway_events_public VIEW
    // (the proven, RLS-friendly read path). A 3s poll is a safety net so the globe
    // still animates if the second realtime channel is flaky. Both dedupe via `seen`.
    type Row = Pick<GatewayEvent, "id" | "event_type" | "payment_attempted" | "chain">;
    const seen = new Set<string>();

    function ingest(rows: Row[]) {
      for (const r of rows) {
        if (!r?.id || seen.has(r.id)) continue;
        seen.add(r.id);
        const tier = classify({ event_type: r.event_type ?? "scan", payment_attempted: !!r.payment_attempted });
        spawnArc(r.chain ?? "base", tier);
      }
      if (seen.size > 800) { // keep the set bounded over long sessions
        let drop = seen.size - 800;
        for (const id of seen) { if (drop-- <= 0) break; seen.delete(id); }
      }
    }

    const channel = supabase
      .channel("globe-events")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gateway_events" }, async (payload) => {
        const id = (payload.new as { id?: string }).id;
        if (!id || seen.has(id)) return;
        const { data } = await supabase
          .from("gateway_events_public")
          .select("id, event_type, payment_attempted, chain")
          .eq("id", id)
          .maybeSingle();
        if (data) ingest([data as Row]);
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") console.warn("[globe] realtime status:", status);
      });

    // Seed recent ids silently (no arc burst on load), then start the poll.
    let poll: ReturnType<typeof setInterval> | undefined;
    (async () => {
      const { data } = await supabase
        .from("gateway_events_public")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(60);
      (data as { id: string }[] | null)?.forEach((r) => seen.add(r.id));

      poll = setInterval(async () => {
        const { data: rows } = await supabase
          .from("gateway_events_public")
          .select("id, event_type, payment_attempted, chain")
          .order("created_at", { ascending: false })
          .limit(15);
        if (rows) ingest([...(rows as Row[])].reverse()); // oldest-first so arcs fire in order
      }, 3000);
    })();

    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      globe.rotation.y += dt * 0.055;
      for (const k in hubs) {
        const h = hubs[k];
        h.pulse = Math.max(0, h.pulse - dt * 1.8);
        h.mesh.scale.setScalar(1 + h.pulse * 2.2);
      }
      for (let i = fx.length - 1; i >= 0; i--) {
        const e = fx[i];
        e.age += dt;
        const p = e.age / e.life;
        if (p >= 1) {
          globe.remove(e.tube, e.head, e.ring);
          e.tube.geometry.dispose();
          e.ring.geometry.dispose();
          fx.splice(i, 1);
          continue;
        }
        (e.tube.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.min(p, 1) * Math.PI) * (e.settled ? 0.95 : 0.7);
        const tp = Math.min(p / 0.5, 1);
        e.head.position.copy(e.curve.getPoint(tp));
        (e.head.material as THREE.MeshBasicMaterial).opacity = 1 - tp;
        e.head.visible = tp < 1;
        const s = 1 + p * (e.settled ? 7 : 4.5);
        e.ring.scale.set(s, s, s);
        (e.ring.material as THREE.MeshBasicMaterial).opacity = (e.settled ? 1 : 0.85) * (1 - p);
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };

    const resize = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      if (poll) clearInterval(poll);
      ro.disconnect();
      supabase.removeChannel(channel);
      renderer.dispose();
      if (renderer.domElement.parentNode === wrap) wrap.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="max-w-3xl mx-auto mb-6">
      <div className="relative rounded-xl border border-[var(--border-subtle)] bg-[rgba(13,20,38,0.4)] overflow-hidden" style={{ height: 420 }}>
        <div ref={wrapRef} className="absolute inset-0" />
        <div className="absolute top-3.5 left-4 right-4 flex justify-between items-center pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">live</span>
          </div>
          <span className="font-mono text-[11px] text-[var(--text-muted)]">gateway.spraay.app</span>
        </div>
      </div>
    </div>
  );
}
