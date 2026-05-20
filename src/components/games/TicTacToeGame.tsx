'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Cell = 'X' | 'O' | null;
type Mode = 'vs-ai' | 'vs-friend';

const WINS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function checkWinner(board: Cell[]): { winner: Cell; line: number[] } | null {
  for (const [a,b,c] of WINS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return { winner: board[a], line: [a,b,c] };
  }
  return null;
}

function isDraw(board: Cell[]) {
  return board.every(Boolean) && !checkWinner(board);
}

function minimax(board: Cell[], isMax: boolean): number {
  const w = checkWinner(board);
  if (w?.winner === 'O') return 10;
  if (w?.winner === 'X') return -10;
  if (board.every(Boolean)) return 0;
  const scores: number[] = [];
  board.forEach((cell, i) => {
    if (!cell) {
      const b = [...board];
      b[i] = isMax ? 'O' : 'X';
      scores.push(minimax(b, !isMax));
    }
  });
  return isMax ? Math.max(...scores) : Math.min(...scores);
}

function bestAIMove(board: Cell[]): number {
  let best = -Infinity;
  let move = -1;
  board.forEach((cell, i) => {
    if (!cell) {
      const b = [...board];
      b[i] = 'O';
      const score = minimax(b, false);
      if (score > best) { best = score; move = i; }
    }
  });
  return move;
}

interface Props {
  onBack: () => void;
}

export default function TicTacToeGame({ onBack }: Props) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [scores, setScores] = useState({ X: 0, O: 0, draw: 0 });
  const [aiThinking, setAiThinking] = useState(false);

  const result = checkWinner(board);
  const draw = isDraw(board);
  const gameOver = !!result || draw;

  const doAIMove = useCallback((b: Cell[]) => {
    setAiThinking(true);
    setTimeout(() => {
      const move = bestAIMove(b);
      if (move === -1) { setAiThinking(false); return; }
      const next = [...b];
      next[move] = 'O';
      setBoard(next);
      setXIsNext(true);
      setAiThinking(false);
      const w = checkWinner(next);
      const d = isDraw(next);
      if (w) setScores(s => ({ ...s, [w.winner as string]: s[w.winner as 'X'|'O'] + 1 }));
      else if (d) setScores(s => ({ ...s, draw: s.draw + 1 }));
    }, 420);
  }, []);

  useEffect(() => {
    if (mode === 'vs-ai' && !xIsNext && !gameOver && !aiThinking) {
      doAIMove(board);
    }
  }, [mode, xIsNext, gameOver, board, aiThinking, doAIMove]);

  function handleClick(i: number) {
    if (!mode || board[i] || gameOver) return;
    if (mode === 'vs-ai' && !xIsNext) return;
    const next = [...board];
    next[i] = xIsNext ? 'X' : 'O';
    setBoard(next);
    const w = checkWinner(next);
    const d = isDraw(next);
    if (w) setScores(s => ({ ...s, [w.winner as string]: s[w.winner as 'X'|'O'] + 1 }));
    else if (d) setScores(s => ({ ...s, draw: s.draw + 1 }));
    setXIsNext(!xIsNext);
  }

  function reset() {
    setBoard(Array(9).fill(null));
    setXIsNext(true);
  }

  function resetAll() {
    setMode(null);
    setBoard(Array(9).fill(null));
    setXIsNext(true);
    setScores({ X: 0, O: 0, draw: 0 });
  }

  const winLine = result?.line ?? [];
  const currentTurn = mode === 'vs-ai'
    ? (xIsNext ? 'Sua vez' : 'IA pensando...')
    : (xIsNext ? 'Vez do X' : 'Vez do O');

  const statusMsg = result
    ? (mode === 'vs-ai'
        ? (result.winner === 'X' ? 'Você venceu!' : 'IA venceu!')
        : `${result.winner} venceu!`)
    : draw ? 'Empate!' : currentTurn;

  const statusColor = result
    ? (result.winner === 'X' ? '#00FFA3' : mode === 'vs-ai' ? '#FF4444' : '#00E5FF')
    : draw ? '#FFD166' : 'rgba(255,255,255,0.6)';

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-4 py-6" style={{ background: 'transparent' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 max-w-lg mx-auto w-full">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-rajdhani text-xs tracking-widest transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#00E5FF'; e.currentTarget.style.borderColor = 'rgba(0,229,255,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          JOGOS
        </button>
        <div>
          <h1 className="font-orbitron font-bold text-sm tracking-widest text-white">JOGO DA VELHA</h1>
          <div className="h-0.5 w-16 mt-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #00E5FF, transparent)' }} />
        </div>
      </div>

      {/* Mode selection */}
      <AnimatePresence mode="wait">
        {!mode ? (
          <motion.div
            key="mode"
            className="flex flex-col items-center gap-6 max-w-lg mx-auto w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-center mb-2">
              <TicTacToeIcon size={80} />
            </div>
            <p className="font-rajdhani text-sm tracking-widest text-white/40 text-center">
              ESCOLHA O MODO DE JOGO
            </p>
            <div className="grid grid-cols-2 gap-4 w-full">
              {[
                { id: 'vs-ai' as const, label: 'VS COMPUTADOR', desc: 'Jogue contra a IA', icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
                  </svg>
                )},
                { id: 'vs-friend' as const, label: 'VS AMIGO', desc: 'Jogue com um amigo', icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                )},
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setMode(opt.id)}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(0,229,255,0.15)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(0,229,255,0.08)';
                    e.currentTarget.style.border = '1px solid rgba(0,229,255,0.4)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.border = '1px solid rgba(0,229,255,0.15)';
                  }}
                >
                  <span style={{ color: '#00E5FF', filter: 'drop-shadow(0 0 8px rgba(0,229,255,0.5))' }}>{opt.icon}</span>
                  <span className="font-orbitron font-bold text-xs tracking-widest text-white">{opt.label}</span>
                  <span className="font-rajdhani text-xs text-white/40">{opt.desc}</span>
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="game"
            className="flex flex-col items-center gap-5 max-w-lg mx-auto w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Scoreboard */}
            <div className="grid grid-cols-3 gap-3 w-full">
              {[
                { label: mode === 'vs-ai' ? 'VOCÊ (X)' : 'JOGADOR X', value: scores.X, color: '#00FFA3' },
                { label: 'EMPATE', value: scores.draw, color: '#FFD166' },
                { label: mode === 'vs-ai' ? 'IA (O)' : 'JOGADOR O', value: scores.O, color: '#00E5FF' },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center gap-1 py-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <span className="font-orbitron font-bold text-xl" style={{ color: s.color, textShadow: `0 0 16px ${s.color}60` }}>
                    {s.value}
                  </span>
                  <span className="font-rajdhani text-xs tracking-widest text-white/30">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Status */}
            <motion.div
              className="font-orbitron font-bold text-sm tracking-widest text-center"
              style={{ color: statusColor }}
              animate={gameOver ? { scale: [1, 1.08, 1] } : {}}
              transition={{ duration: 0.4 }}
            >
              {statusMsg}
            </motion.div>

            {/* Board */}
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: 'repeat(3, 1fr)', width: '100%', maxWidth: 320 }}
            >
              {board.map((cell, i) => {
                const isWinCell = winLine.includes(i);
                return (
                  <motion.button
                    key={i}
                    onClick={() => handleClick(i)}
                    whileHover={!cell && !gameOver ? { scale: 1.03 } : {}}
                    whileTap={!cell && !gameOver ? { scale: 0.96 } : {}}
                    className="aspect-square rounded-xl flex items-center justify-center"
                    style={{
                      background: isWinCell
                        ? (cell === 'X' ? 'rgba(0,255,163,0.12)' : 'rgba(0,229,255,0.12)')
                        : 'rgba(255,255,255,0.03)',
                      border: isWinCell
                        ? `2px solid ${cell === 'X' ? '#00FFA3' : '#00E5FF'}`
                        : '1px solid rgba(255,255,255,0.08)',
                      cursor: cell || gameOver ? 'default' : 'pointer',
                      minHeight: 88,
                    }}
                  >
                    <AnimatePresence>
                      {cell && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="font-orbitron font-bold select-none"
                          style={{
                            fontSize: '2rem',
                            color: cell === 'X' ? '#00FFA3' : '#00E5FF',
                            textShadow: cell === 'X'
                              ? '0 0 20px rgba(0,255,163,0.8)'
                              : '0 0 20px rgba(0,229,255,0.8)',
                          }}
                        >
                          {cell}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 w-full max-w-xs">
              <button
                onClick={reset}
                className="flex-1 py-2.5 rounded-xl font-rajdhani font-bold text-xs tracking-widest transition-all"
                style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.3)', color: '#00E5FF' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.12)'; }}
              >
                NOVA RODADA
              </button>
              <button
                onClick={resetAll}
                className="px-4 py-2.5 rounded-xl font-rajdhani font-bold text-xs tracking-widest transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
              >
                MENU
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TicTacToeIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="ttt-glow">
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g filter="url(#ttt-glow)" stroke="#00E5FF" strokeWidth="2.5" strokeLinecap="round">
        {/* grid lines */}
        <line x1="22" y1="4" x2="22" y2="60"/>
        <line x1="42" y1="4" x2="42" y2="60"/>
        <line x1="4" y1="22" x2="60" y2="22"/>
        <line x1="4" y1="42" x2="60" y2="42"/>
        {/* O top-left */}
        <circle cx="13" cy="13" r="5" stroke="#00E5FF" strokeWidth="2.5" fill="none"/>
        {/* X top-center */}
        <line x1="28" y1="8" x2="36" y2="16" stroke="#00FFA3" strokeWidth="2.5"/>
        <line x1="36" y1="8" x2="28" y2="16" stroke="#00FFA3" strokeWidth="2.5"/>
        {/* O top-right */}
        <circle cx="51" cy="13" r="5" stroke="#00E5FF" strokeWidth="2.5" fill="none"/>
        {/* X mid-left */}
        <line x1="8" y1="28" x2="16" y2="36" stroke="#00FFA3" strokeWidth="2.5"/>
        <line x1="16" y1="28" x2="8" y2="36" stroke="#00FFA3" strokeWidth="2.5"/>
        {/* O center */}
        <circle cx="32" cy="32" r="5" stroke="#00E5FF" strokeWidth="2.5" fill="none"/>
        {/* X mid-right */}
        <line x1="47" y1="28" x2="55" y2="36" stroke="#00FFA3" strokeWidth="2.5"/>
        <line x1="55" y1="28" x2="47" y2="36" stroke="#00FFA3" strokeWidth="2.5"/>
        {/* O bottom-left */}
        <circle cx="13" cy="51" r="5" stroke="#00E5FF" strokeWidth="2.5" fill="none"/>
        {/* X bottom-center */}
        <line x1="28" y1="47" x2="36" y2="55" stroke="#00FFA3" strokeWidth="2.5"/>
        <line x1="36" y1="47" x2="28" y2="55" stroke="#00FFA3" strokeWidth="2.5"/>
        {/* O bottom-right */}
        <circle cx="51" cy="51" r="5" stroke="#00E5FF" strokeWidth="2.5" fill="none"/>
      </g>
    </svg>
  );
}
