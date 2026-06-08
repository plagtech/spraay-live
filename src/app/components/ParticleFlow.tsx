'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  stage: number;
}

const STAGE_COLORS = ['#8BA3C7', '#3B9EFF', '#FBBF24', '#4ADE80'];
const STAGE_LABELS = ['Scan', 'Quote', 'Attempt', 'Settle'];

export default function ParticleFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const dimensions = useRef({ w: 0, h: 0 });
  const frameRef = useRef(0);

  const spawn = useCallback(() => {
    const { h } = dimensions.current;
    if (!h) return;
    particles.current.push({
      x: -4,
      y: h / 2 + (Math.random() - 0.5) * 28,
      vx: 1.2 + Math.random() * 1.5,
      vy: 0,
      life: 1,
      size: 1.5 + Math.random() * 2,
      stage: 0,
    });
  }, []);

  // Expose spawn for external triggers (Supabase events)
  useEffect(() => {
    (window as any).__spraaySpawnParticle = spawn;
    return () => { delete (window as any).__spraaySpawnParticle; };
  }, [spawn]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
      const rect = canvas!.parentElement!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx!.scale(dpr, dpr);
      dimensions.current = { w: rect.width, h: rect.height };
    }

    resize();
    window.addEventListener('resize', resize);

    let animId: number;
    let frame = 0;

    function draw() {
      const { w, h } = dimensions.current;
      ctx!.clearRect(0, 0, w, h);

      const stageX = [w * 0.125, w * 0.375, w * 0.625, w * 0.875];

      // Draw stage dividers
      ctx!.setLineDash([2, 5]);
      ctx!.strokeStyle = 'rgba(138, 163, 199, 0.08)';
      for (let i = 0; i < 3; i++) {
        const x = (i + 1) * w / 4;
        ctx!.beginPath();
        ctx!.moveTo(x, 6);
        ctx!.lineTo(x, h - 6);
        ctx!.stroke();
      }
      ctx!.setLineDash([]);

      // Auto-spawn
      frame++;
      if (frame % 7 === 0 && particles.current.length < 50) {
        spawn();
      }

      // Update and draw particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.x += p.vx;
        p.y += Math.sin(p.x * 0.025 + i) * 0.35;

        // Advance stage
        if (p.stage < 3 && p.x > stageX[p.stage]) {
          p.stage++;
        }

        // Remove off-screen
        if (p.x > w + 10) {
          particles.current.splice(i, 1);
          continue;
        }

        // Fade as particle travels
        p.life = Math.max(0.15, 1 - (p.x / w) * 0.4);

        const color = STAGE_COLORS[p.stage];

        // Glow
        ctx!.globalAlpha = p.life * 0.12;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2);
        ctx!.fillStyle = color;
        ctx!.fill();

        // Core dot
        ctx!.globalAlpha = p.life * 0.6;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = color;
        ctx!.fill();
      }

      ctx!.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [spawn]);

  return (
    <div className="relative w-full max-w-3xl mx-auto mb-6 h-16 rounded-lg bg-slate-900/40 border border-slate-800/50 overflow-hidden fade-up fade-up-3">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 flex justify-around items-center pointer-events-none">
        {STAGE_LABELS.map((label, i) => (
          <div key={label} className="text-center">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: STAGE_COLORS[i], opacity: 0.5 }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
