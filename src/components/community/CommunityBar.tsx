'use client';
import { useEffect, useState } from 'react';

function useMarketingImage() {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/marketing/random')
      .then(r => r.json())
      .then(data => { if (data?.imageData) setSrc(data.imageData); })
      .catch(() => {});
  }, []);
  return src;
}

export default function CommunityBar() {
  const marketingImg = useMarketingImage();
  return (
    <div
      className="relative z-20 w-full flex items-stretch hide-in-obs"
      style={{
        background: 'rgba(5,8,22,0.92)',
        borderTop: '1px solid rgba(0,229,255,0.12)',
        minHeight: '96px',
      }}
    >
      {/* LEFT — PlayerSkins WEAR banner */}
      <div
        className="flex items-stretch flex-shrink-0 overflow-hidden"
        style={{ borderRight: '1px solid rgba(0,229,255,0.1)', width: '420px' }}
      >
        {/* Marketing image slot */}
        <div
          className="relative flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{ width: '160px', alignSelf: 'stretch', background: 'rgba(0,0,0,0.45)' }}
        >
          {marketingImg ? (
            <img
              src={marketingImg}
              alt="marketing"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span className="font-rajdhani text-white/15 tracking-widest uppercase text-xs">
              imagem
            </span>
          )}
        </div>

        {/* Branding em coluna única */}
        <div className="flex-1 flex flex-col justify-center px-5 py-3 gap-0.5">
          <img
            src="/wordmark.png"
            alt="PlayerSkins"
            className="object-contain object-left opacity-80"
            style={{ height: '16.8px', marginBottom: '3px' }}
          />
          <span
            className="font-orbitron font-black text-white"
            style={{ fontSize: '18px', letterSpacing: '0.1em', lineHeight: 1.1 }}
          >
            WEAR
          </span>
          <p
            className="font-rajdhani text-white/40 tracking-widest uppercase"
            style={{ fontSize: '10px' }}
          >
            VISTA O GAME. VIVA O HYPE.
          </p>
          <div className="flex items-center gap-2" style={{ marginTop: '3px' }}>
            <a
              href="https://www.playerskins.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-rajdhani tracking-wider transition-all hover:opacity-75"
              style={{ fontSize: '10px', color: 'rgba(0,229,255,0.75)' }}
            >
              www.playerskins.com.br
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
              </svg>
            </a>
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded font-rajdhani tracking-wider"
              style={{
                background: 'rgba(0,229,255,0.08)',
                border: '1px solid rgba(0,229,255,0.25)',
                fontSize: '10px',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>CUPOM:</span>
              <span className="font-bold" style={{ color: 'rgba(0,229,255,0.9)' }}>GANJA10</span>
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE — Info text (original) */}
      <div
        className="flex-1 flex items-center justify-center px-8 py-5"
        style={{ borderRight: '1px solid rgba(0,229,255,0.1)' }}
      >
        <div className="text-center max-w-md">
          <p className="font-rajdhani text-white/35 leading-snug" style={{ fontSize: '17px' }}>
            10% de todas as vendas com seu cupom são convertidas
            <br />
            em créditos para sorteios e ativações.
          </p>
          <button
            className="font-rajdhani tracking-widest mt-1.5 transition-all hover:opacity-80"
            style={{ fontSize: '15px', color: 'rgba(0,229,255,0.6)' }}
          >
            SAIBA MAIS &gt;
          </button>
        </div>
      </div>

      {/* RIGHT — Rank da Comunidade (original) */}
      <div className="flex items-center gap-6 px-8 py-5 flex-shrink-0">
        <div className="flex flex-col gap-2">
          <span className="font-rajdhani text-white/40 tracking-widest uppercase" style={{ fontSize: '13px' }}>
            RANK DA COMUNIDADE
          </span>

          <div className="flex items-center gap-4">
            <span className="font-orbitron font-bold" style={{ fontSize: '24px', color: '#F5A623', letterSpacing: '0.06em' }}>
              OURO
            </span>

            <div className="flex flex-col gap-1">
              <div
                className="rounded-full overflow-hidden"
                style={{ width: '165px', height: '8px', background: 'rgba(255,255,255,0.08)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: '72.5%',
                    background: 'linear-gradient(90deg, #F5A623, #FFD700)',
                    boxShadow: '0 0 8px rgba(245,166,35,0.6)',
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-orbitron" style={{ fontSize: '12px', color: 'rgba(245,166,35,0.8)' }}>
                  7.250
                </span>
                <span className="font-orbitron text-white/25" style={{ fontSize: '12px' }}>
                  / 10.000
                </span>
              </div>
              <span className="font-rajdhani text-white/30 tracking-widest" style={{ fontSize: '12px' }}>
                PRÓXIMO: DIAMANTE
              </span>
            </div>
          </div>
        </div>

        {/* Crown badge */}
        <div
          className="relative flex-shrink-0 rounded-lg flex items-center justify-center"
          style={{
            width: '60px',
            height: '60px',
            background: 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(255,215,0,0.08))',
            border: '1px solid rgba(245,166,35,0.35)',
            boxShadow: '0 0 20px rgba(245,166,35,0.15)',
          }}
        >
          <svg width="33" height="33" viewBox="0 0 24 24" fill="none">
            <path
              d="M2 18l2.5-8L9 14l3-8 3 8 4.5-4L22 18H2z"
              fill="rgba(245,166,35,0.9)"
              stroke="rgba(255,215,0,0.6)"
              strokeWidth="0.5"
            />
            <rect x="2" y="18" width="20" height="2" rx="1" fill="rgba(245,166,35,0.7)" />
          </svg>
        </div>
      </div>
    </div>
  );
}
