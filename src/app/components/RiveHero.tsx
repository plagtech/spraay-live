'use client';

import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';

export default function RiveHero() {
  const { RiveComponent } = useRive({
    src: '/nature.riv',
    autoplay: true,
    layout: new Layout({
      fit: Fit.Cover,
      alignment: Alignment.Center,
    }),
  });

  return (
    <div className="rive-hero">
      <RiveComponent />
      <div className="rive-overlay">
        <div className="rive-title">
          <span className="text-3xl">💧</span>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Spraay Live
          </h1>
        </div>
        <p className="text-sm text-white/60">
          Live x402 gateway activity — as it happens
        </p>
      </div>
    </div>
  );
}
