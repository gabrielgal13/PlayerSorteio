'use client';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import ParticleCanvas from '@/components/effects/ParticleCanvas';
import NeonGrid from '@/components/effects/NeonGrid';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const login = useStore(s => s.login);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    try {
      await login({ username, password, rememberMe, mascot: 'careca' });
    } catch {
      setError('ACESSO NEGADO — Credenciais inválidas');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden flex items-center justify-center"
      style={{ backgroundImage: 'url(/FundoLogin.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>

      <ParticleCanvas count={120} intensity="medium" />
      <NeonGrid />

      {/* Smoke layers */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-full h-64 rounded-full"
            style={{
              bottom: `${i * 8}%`,
              background: `radial-gradient(ellipse, rgba(0,229,255,${0.03 - i * 0.005}) 0%, transparent 70%)`,
              filter: 'blur(40px)',
            }}
            animate={{ scaleX: [1, 1.1, 0.95, 1], opacity: [0.5, 0.8, 0.6, 0.5] }}
            transition={{ duration: 6 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
          />
        ))}
      </div>

      {/* Logo top */}
      <motion.div
        className="absolute top-8 left-0 right-0 flex flex-col items-center"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.3 }}
      >
        <span className="font-rajdhani text-xs tracking-[0.5em] text-neon-cyan/60 uppercase mb-2">Plataforma</span>
        <motion.img
          src="/wordmark.png"
          alt="PlayerSkins"
          style={{ height: '52px', width: 'auto', objectFit: 'contain' }}
          animate={{ opacity: [0.9, 1, 0.9] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <div className="flex items-center gap-3 mt-2">
          <div className="w-12 h-px bg-gradient-to-r from-transparent to-neon-cyan opacity-40" />
          <span className="font-rajdhani text-xs tracking-[0.5em] text-neon-cyan/60 uppercase">Sorteios para Streamers</span>
          <div className="w-12 h-px bg-gradient-to-l from-transparent to-neon-cyan opacity-40" />
        </div>
      </motion.div>

      {/* Central login card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Outer glow ring */}
        <motion.div
          className="absolute -inset-px rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(0,229,255,0.4), rgba(0,207,255,0.2), rgba(0,229,255,0.4))',
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        {/* Card */}
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(8,8,17,0.85)',
            border: '1px solid rgba(0,229,255,0.2)',
          }}
        >
          {/* Top accent bar */}
          <div className="h-0.5 w-full neon-progress" />

          <div className="p-8 md:p-10">
            {/* Icon */}
            <motion.div
              className="flex justify-center mb-6"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="relative">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,229,255,0.3), rgba(0,207,255,0.2))',
                    border: '1px solid rgba(0,229,255,0.4)',
                    boxShadow: '0 0 30px rgba(0,229,255,0.4)',
                  }}
                >
                  <img src="/favicon-logo.png" alt="logo" style={{ width: 70, height: 70, objectFit: 'contain' }} />
                </div>
                <motion.div
                  className="absolute -inset-2 rounded-xl"
                  style={{ border: '1px solid rgba(0,229,255,0.2)' }}
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            </motion.div>

            <h2 className="font-orbitron text-center text-white text-xl font-bold mb-1 tracking-wider">
              ACESSO STREAMER
            </h2>
            <p className="text-center text-white/30 text-xs tracking-widest uppercase mb-8 font-rajdhani">
              Autenticação de Streamer
            </p>

            <motion.form
              ref={formRef}
              onSubmit={handleSubmit}
              animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              {/* Username */}
              <div className="space-y-1.5">
                <label className="block font-rajdhani text-xs tracking-widest text-white/40 uppercase">
                  Usuário
                </label>
                <div className="relative">
                  <div className="absolute top-1/2 -translate-y-1/2 text-neon-purple/60 pointer-events-none" style={{ left: '12px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Seu username de streamer"
                    required
                    className="input-neon w-full pr-4 py-3 rounded-lg font-rajdhani text-sm tracking-wide"
                    style={{ paddingLeft: '40px' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block font-rajdhani text-xs tracking-widest text-white/40 uppercase">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute top-1/2 -translate-y-1/2 text-neon-purple/60 pointer-events-none" style={{ left: '12px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 1C8.7 1 6 3.7 6 7v2H4v14h16V9h-2V7c0-3.3-2.7-6-6-6zm0 2c2.2 0 4 1.8 4 4v2H8V7c0-2.2 1.8-4 4-4zm0 10c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/>
                    </svg>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="input-neon w-full pr-4 py-3 rounded-lg font-rajdhani text-sm tracking-wide"
                    style={{ paddingLeft: '40px' }}
                  />
                </div>
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-2.5 cursor-pointer group w-fit">
                <div className="relative w-4 h-4 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className="w-4 h-4 rounded transition-all"
                    style={{
                      background: rememberMe ? 'rgba(0,229,255,0.3)' : 'transparent',
                      border: rememberMe ? '1.5px solid rgba(0,229,255,0.9)' : '1.5px solid rgba(255,255,255,0.2)',
                      boxShadow: rememberMe ? '0 0 8px rgba(0,229,255,0.4)' : 'none',
                    }}
                  >
                    {rememberMe && (
                      <svg className="absolute inset-0 w-full h-full p-0.5" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#00E5FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
                <span className="font-rajdhani text-xs tracking-widest uppercase group-hover:text-white/60 transition-colors"
                  style={{ color: rememberMe ? 'rgba(0,229,255,0.8)' : 'rgba(255,255,255,0.35)' }}>
                  Lembrar de mim por 30 dias
                </span>
              </label>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF4444">
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    <span className="font-rajdhani text-xs tracking-wide" style={{ color: '#FF4444' }}>
                      {error}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit button */}
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="relative w-full py-3.5 rounded-lg font-orbitron font-bold tracking-widest text-sm overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  background: isLoading
                    ? 'rgba(0,229,255,0.3)'
                    : 'linear-gradient(135deg, #00E5FF 0%, #1F8CFF 50%, #0066BB 100%)',
                  boxShadow: '0 0 30px rgba(0,229,255,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                }}
              >
                {/* Shimmer */}
                {!isLoading && (
                  <motion.div
                    className="absolute inset-0 shimmer-bg"
                    animate={{ backgroundPosition: ['-200% 0', '200% 0'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                )}
                <span className="relative z-10">
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span
                        className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      />
                      AUTENTICANDO...
                    </span>
                  ) : (
                    'ACESSAR'
                  )}
                </span>
              </motion.button>
            </motion.form>
          </div>
        </div>
      </motion.div>

      {/* Bottom status bar */}
      <motion.div
        className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <div className="flex items-center gap-1.5">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-neon-green"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="font-rajdhani text-xs text-white tracking-widest">SISTEMA ONLINE</span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <span className="font-rajdhani text-xs text-white tracking-widest">v2.0 ULTRA</span>
      </motion.div>
    </div>
  );
}
