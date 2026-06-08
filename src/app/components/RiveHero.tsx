'use client';

import { useRive, useStateMachineInput, Layout, Fit, Alignment } from '@rive-app/react-canvas';
import { useEffect } from 'react';

export default function RiveHero() {
  const { rive, RiveComponent } = useRive({
    src: '/nature.riv',
    autoplay: true,
    layout: new Layout({
      fit: Fit.Cover,
      alignment: Alignment.Center,
    }),
  });

  // Try to start any available state machines or animations
  useEffect(() => {
    if (!rive) return;

    // Log what's available (check browser console to find the right names)
    console.log('[Rive] Available state machines:', rive.stateMachineNames);
    console.log('[Rive] Available animations:', rive.animationNames);

    // Try to play the first available animation or state machine
    const smNames = rive.stateMachineNames;
    if (smNames && smNames.length > 0) {
      rive.play(smNames[0]);
      console.log('[Rive] Playing state machine:', smNames[0]);
    } else {
      const animNames = rive.animationNames;
      if (animNames && animNames.length > 0) {
        rive.play(animNames[0]);
        console.log('[Rive] Playing animation:', animNames[0]);
      }
    }
  }, [rive]);

  return (
    <div>
      <div className="rive-hero">
        <RiveComponent />
      </div>
      <div className="rive-bar">
        <span className="text-2xl">💧</span>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Spraay Live
        </h1>
        <span className="text-sm text-[var(--text-muted)] ml-2">
          Live x402 gateway activity — as it happens
        </span>
      </div>
    </div>
  );
}
