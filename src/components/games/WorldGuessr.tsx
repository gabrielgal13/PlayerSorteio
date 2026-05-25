'use client';
import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/store/useStore';

interface Props {
  onBack: () => void;
}

const WORLDGUESSR_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://worldguesser.playerskins.com.br/'
    : 'http://localhost:3002';

export default function WorldGuessr({ onBack }: Props) {
  const { chatMessages, chatRegistrationActive, setChatRegistrationRequested } = useStore();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatRegistrationActive) {
      setChatRegistrationRequested(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(0,229,255,0.1)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 font-orbitron text-xs tracking-widest transition-all"
          style={{ color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#00E5FF')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          VOLTAR
        </button>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)' }} />

        <GlobeIcon />
        <span className="font-orbitron font-bold text-sm tracking-widest text-white">
          WORLDGUESSR
        </span>
      </div>

      {/* Body: jogo + chat lado a lado */}
      <div className="flex flex-1 min-h-0">

        {/* iframe do jogo */}
        <motion.div
          className="flex-1 min-h-0 min-w-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <iframe
            src={WORLDGUESSR_URL}
            title="WorldGuessr"
            className="w-full h-full border-0"
            allow="fullscreen; geolocation"
            style={{ display: 'block' }}
          />
        </motion.div>

        {/* Chat da live */}
        <div
          className="flex flex-col flex-shrink-0"
          style={{
            width: '272px',
            background: 'rgba(5,8,22,0.93)',
            borderLeft: '1px solid rgba(255,255,255,0.09)',
          }}
        >
          {/* Header do chat */}
          <div
            className="flex items-center gap-3 flex-shrink-0"
            style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <span className="font-orbitron text-white/40 tracking-widest text-xs">CHAT DA LIVE</span>
            <motion.div
              className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          </div>

          {/* Mensagens */}
          <div
            className="flex-1 overflow-y-auto space-y-3 min-h-0"
            style={{ padding: '16px 20px', scrollbarWidth: 'none' }}
          >
            {chatMessages.length === 0 ? (
              <p className="font-rajdhani text-white/20 text-center tracking-wider leading-relaxed text-xs">
                aguardando mensagens...
              </p>
            ) : (
              chatMessages.slice(-50).map(msg => (
                <div key={msg.id} className="leading-relaxed break-words text-xs">
                  <span className="font-rajdhani font-bold" style={{ color: msg.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {msg.source === 'twitch' && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="#9147FF" style={{ flexShrink: 0 }}>
                        <path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29l-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.89V3.43h11.25z"/>
                      </svg>
                    )}
                    {msg.source === 'kick' && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="#53FC1C" style={{ flexShrink: 0 }}>
                        <path d="M4 3h4v7.5L12.5 3H18l-6 9 6 9h-5.5L8 13.5V21H4V3z"/>
                      </svg>
                    )}
                    {msg.source === 'youtube' && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FF0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/>
                        <path d="m10 15 5-3-5-3z"/>
                      </svg>
                    )}
                    {msg.username}
                  </span>
                  <span className="font-rajdhani text-white/25">: </span>
                  <span className="font-rajdhani text-white/65">{msg.text}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9.5" stroke="#00E5FF" strokeWidth="1.8"/>
      <ellipse cx="12" cy="12" rx="3.5" ry="9.5" stroke="#00E5FF" strokeWidth="1.8"/>
      <line x1="2.5" y1="9" x2="21.5" y2="9" stroke="#00E5FF" strokeWidth="1.8"/>
      <line x1="2.5" y1="15" x2="21.5" y2="15" stroke="#00E5FF" strokeWidth="1.8"/>
    </svg>
  );
}
