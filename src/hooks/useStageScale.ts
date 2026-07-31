'use client';
import { useEffect, useState } from 'react';

/**
 * Resolução de referência: o layout foi desenhado numa janela de ~1920x940
 * (1080p com a barra do navegador). Em telas maiores o mascote ficava pequeno
 * no OBS porque o SVG tem tamanho fixo em px.
 */
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 940;

export const STAGE_SCALE_VAR = '--stage-scale';

function computeScale(min: number, max: number) {
  if (typeof window === 'undefined') return 1;
  const raw = Math.min(window.innerWidth / BASE_WIDTH, window.innerHeight / BASE_HEIGHT);
  return Math.min(max, Math.max(min, raw));
}

/**
 * Fator que mantém o mascote com o mesmo tamanho relativo em qualquer
 * resolução — 1 na tela de referência, maior em monitores 1440p/4K.
 */
export function useStageScale(min = 0.72, max = 1.9) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => setScale(computeScale(min, max));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [min, max]);

  return scale;
}
