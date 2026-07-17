'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import ParticleCanvas from '@/components/effects/ParticleCanvas';
import NeonGrid from '@/components/effects/NeonGrid';

export default function ChangePasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const currentUser = useStore(s => s.currentUser);
  const setForcePasswordChange = useStore(s => s.setForcePasswordChange);
  const logout = useStore(s => s.logout);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/streamer/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser?.username, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Erro ao alterar senha.');
        setShake(true);
        setTimeout(() => setShake(false), 600);
      } else {
        setForcePasswordChange(false);
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative w-full h-screen overflow-hidden flex items-center justify-center"
      style={{
        backgroundImage: 'url(/FundoLogin.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <ParticleCanvas count={80} intensity="medium" />
      <NeonGrid />

      {/* Smoke */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-full h-64 rounded-full"
            style={{
              bottom: `${i * 8}%`,
              background: `radial-gradient(ellipse, rgba(0,229,255,${0.03 - i * 0.006}) 0%, transparent 70%)`,
              filter: 'blur(40px)',
            }}
            animate={{ scaleX: [1, 1.1, 0.95, 1], opacity: [0.5, 0.8, 0.6, 0.5] }}
            transition={{ duration: 6 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Glow ring */}
        <motion.div
          className="absolute -inset-px rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(0,229,255,0.4), rgba(0,207,255,0.2), rgba(0,229,255,0.4))',
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ background: 'rgba(8,8,17,0.85)', border: '1px solid rgba(0,229,255,0.2)' }}
        >
          <div className="h-0.5 w-full neon-progress" />

          <div className="p-8 md:p-10">
            {/* Icon */}
            <motion.div
              className="flex justify-center mb-6"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,229,255,0.3), rgba(0,207,255,0.2))',
                  border: '1px solid rgba(0,229,255,0.4)',
                  boxShadow: '0 0 30px rgba(0,229,255,0.4)',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="rgba(0,229,255,0.9)">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                </svg>
              </div>
            </motion.div>

            <h2 className="font-orbitron text-center text-white text-xl font-bold mb-1 tracking-wider">
              ALTERAR SENHA
            </h2>
            <p className="text-center text-white/40 text-xs tracking-widest uppercase mb-2 font-rajdhani">
              Primeiro acesso detectado
            </p>
            <p className="text-center font-rajdhani text-sm mb-8" style={{ color: 'rgba(0,229,255,0.75)' }}>
              Por segurança, defina uma nova senha antes de continuar.
            </p>

            <motion.form
              onSubmit={handleSubmit}
              animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              {/* Nova senha */}
              <div className="space-y-1.5">
                <label className="block font-rajdhani text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    className="w-full pr-12 py-3 rounded-lg font-rajdhani text-sm tracking-wide outline-none px-4"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(0,229,255,0.25)',
                      color: 'rgba(255,255,255,0.85)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    className="absolute top-1/2 -translate-y-1/2 right-3 transition-opacity opacity-40 hover:opacity-80"
                  >
                    {showNew ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23" stroke="white" strokeWidth="2"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirmar senha */}
              <div className="space-y-1.5">
                <label className="block font-rajdhani text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Confirmar Senha
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    required
                    className="w-full pr-12 py-3 rounded-lg font-rajdhani text-sm tracking-wide outline-none px-4"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${confirmPassword && confirmPassword !== newPassword ? 'rgba(255,68,68,0.4)' : 'rgba(0,229,255,0.25)'}`,
                      color: 'rgba(255,255,255,0.85)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute top-1/2 -translate-y-1/2 right-3 transition-opacity opacity-40 hover:opacity-80"
                  >
                    {showConfirm ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23" stroke="white" strokeWidth="2"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

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
                    <span className="font-rajdhani text-xs tracking-wide" style={{ color: '#FF4444' }}>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
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
                  color: 'white',
                }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                    SALVANDO...
                  </span>
                ) : (
                  'DEFINIR NOVA SENHA'
                )}
              </motion.button>
            </motion.form>

            {/* Logout link */}
            <div className="mt-5 text-center">
              <button
                onClick={logout}
                className="font-rajdhani text-xs tracking-widest uppercase transition-colors hover:opacity-70"
                style={{ color: 'rgba(255,255,255,0.2)' }}
              >
                Sair da conta
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
