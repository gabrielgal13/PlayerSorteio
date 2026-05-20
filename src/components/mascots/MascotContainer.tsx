'use client';
import { useStore } from '@/store/useStore';
import MascotNakelas from './MascotNakelas';
import MascotShadowGanjaK from './MascotShadowGanjaK';
import StageBase from './StageBase';

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

  if (withStage) {
    return (
      <div className="relative w-full h-full">
        <StageBase />
        {/* Lift the mascot so its feet sit at the stage top platform level */}
        <div className="absolute inset-0" style={{ bottom: '130px' }}>
          {mascot}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {mascot}
    </div>
  );
}
