'use client';
import { useStore } from '@/store/useStore';
import MascotNakelas from './MascotNakelas';
import MascotShadowGanjaK from './MascotShadowGanjaK';

interface MascotContainerProps {
  isExploding: boolean;
  isScorched: boolean;
  withStage?: boolean;
}

export default function MascotContainer({ isExploding, isScorched, withStage = false }: MascotContainerProps) {
  const { currentUser, raffleStatus, currentWinner } = useStore();

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
      {mascot}
    </div>
  );
}
