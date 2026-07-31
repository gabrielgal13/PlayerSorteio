'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import ConfettiExplosion from '@/components/effects/ConfettiExplosion';
import FireworksExplosion from '@/components/effects/FireworksExplosion';
import SparklesExplosion from '@/components/effects/SparklesExplosion';
import RaffleAnimation from '@/components/effects/RaffleAnimation';
import ParticleCanvas from '@/components/effects/ParticleCanvas';
import type { RaffleAnimationStyle } from '@/types';

function Inner() {
  const q = useSearchParams();
  const fx = q.get('fx') ?? 'confetti';
  const light = (q.get('light') ?? 'balada') as RaffleAnimationStyle;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050816', overflow: 'hidden' }}>
      <ParticleCanvas count={50} intensity="low" />

      {/* stand-in do mascote: silhueta clara no centro-baixo */}
      <div style={{
        position: 'absolute', left: '50%', bottom: '8%', transform: 'translateX(-50%)',
        width: 260, height: 380, borderRadius: '130px 130px 40px 40px',
        background: 'linear-gradient(180deg,#E8C9A0,#7A4F28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#000', fontFamily: 'monospace', fontSize: 22, fontWeight: 700,
      }}>
        MASCOTE
      </div>

      {fx === 'light' && <RaffleAnimation active animStyle={light} />}
      <ConfettiExplosion active={fx === 'confetti'} originX={50} originY={40} />
      <FireworksExplosion active={fx === 'fireworks'} color="#00E5FF" />
      <SparklesExplosion active={fx === 'sparkles'} color="#FFD166" />
    </div>
  );
}

export default function FxTest() {
  return <Suspense><Inner /></Suspense>;
}
