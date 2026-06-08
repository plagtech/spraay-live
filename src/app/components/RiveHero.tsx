'use client';

import { useRive } from '@rive-app/react-canvas';

export default function RiveHero() {
  const { RiveComponent } = useRive({
    src: '/nature.riv',
    autoplay: true,
  });

  return (
    <div className="rive-hero">
      <RiveComponent />
      <div className="rive-overlay">
        <span className="text-2xl">💧</span>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Spraay Live
        </h1>
        <p className="text-xs text-white/60 mt-1">
          Live x402 gateway activity — as it happens
        </p>
      </div>
    </div>
  );
}
