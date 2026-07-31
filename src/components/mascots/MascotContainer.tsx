'use client';
import { useStore } from '@/store/useStore';
import { useStageScale } from '@/hooks/useStageScale';
import MascotNakelas from './MascotNakelas';
import MascotShadowGanjaK from './MascotShadowGanjaK';

interface MascotContainerProps {
  isExploding: boolean;
  isScorched: boolean;
  withStage?: boolean;
  /** Limite superior do fator de escala responsiva. */
  maxScale?: number;
}

export default function MascotContainer({ isExploding, isScorched, withStage = false, maxScale = 1.9 }: MascotContainerProps) {
  const { currentUser, raffleStatus, currentWinner } = useStore();
  const stageScale = useStageScale(0.72, maxScale);

  if (!currentUser) return null;

  const winnerNumber = currentWinner?.number ?? null;

  const mascot = currentUser.mascot === 'careca' ? (
    <MascotNakelas
      status={raffleStatus}
      winnerNumber={winnerNumber}
      isExploding={isExploding}
      isScorched={isScorched}
    />
  ) : (
    <MascotShadowGanjaK
      status={raffleStatus}
      winnerNumber={winnerNumber}
      isExploding={isExploding}
      isScorched={isScorched}
    />
  );

  return (
    <div className="relative w-full h-full">
      <div
        className="w-full h-full"
        style={{ transform: `scale(${stageScale})`, transformOrigin: 'bottom center' }}
      >
        {mascot}
      </div>
    </div>
  );
}
