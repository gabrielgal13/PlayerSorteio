'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import type { Participant } from '@/types';

interface ImportError {
  row: number;
  message: string;
}

function PlatformIcon({ source }: { source: 'twitch' | 'kick' | 'youtube' }) {
  if (source === 'twitch') return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="#9146FF" style={{ flexShrink: 0 }}>
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
    </svg>
  );
  if (source === 'kick') return (
    <svg width="11" height="11" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d="M7 6v12h2.8v-4l1.1-1.1 3.7 5.1H18l-5-6.5L17.8 6h-3.4l-4.6 5.2V6z" fill="#53FC18"/>
    </svg>
  );
  if (source === 'youtube') return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="#FF0000" style={{ flexShrink: 0 }}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
  return null;
}

export default function ParticipantImport() {
  const {
    participants, setParticipants, setActiveTab,
    chatRegistrationActive,
    setChatRegistrationRequested, setChatRegistrationStopRequested,
    twitchConfig, excelImportEnabled,
  } = useStore();

  const [isRequestingChat, setIsRequestingChat] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [fileName, setFileName] = useState('');
  const [importCount, setImportCount] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setErrors([]);
    setImportCount(0);
    setFileName(file.name);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let rows: unknown[][] = [];

      if (ext === 'csv') {
        const text = await file.text();
        rows = text
          .split('\n')
          .map(line => line.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
      } else if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
      } else {
        setErrors([{ row: 0, message: 'Formato inválido. Use .xlsx, .xls ou .csv' }]);
        setIsProcessing(false);
        return;
      }

      const errs: ImportError[] = [];
      const parsed: Participant[] = [];
      const seenNumbers = new Set<number>();

      // detect header
      let startRow = 0;
      if (rows[0]) {
        const first = String((rows[0] as unknown[])[0] ?? '').toLowerCase();
        if (
          first.includes('número') || first.includes('numero') ||
          first.includes('number') || first === 'n' || first === '#'
        ) {
          startRow = 1;
        }
      }

      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i] as unknown[];
        if (!row || row.length < 2) continue;

        const rawNum = String(row[0] ?? '').trim();
        const rawName = String(row[1] ?? '').trim();

        if (!rawNum && !rawName) continue;

        const num = parseInt(rawNum, 10);
        if (isNaN(num)) {
          errs.push({ row: i + 1, message: `Linha ${i + 1}: número inválido "${rawNum}"` });
          continue;
        }
        if (!rawName) {
          errs.push({ row: i + 1, message: `Linha ${i + 1}: nome vazio` });
          continue;
        }
        if (seenNumbers.has(num)) {
          errs.push({ row: i + 1, message: `Linha ${i + 1}: número duplicado ${num}` });
          continue;
        }

        seenNumbers.add(num);
        parsed.push({ id: `p_${num}`, number: num, name: rawName });
      }

      if (parsed.length === 0 && errs.length === 0) {
        errs.push({ row: 0, message: 'Arquivo vazio ou sem dados válidos' });
      }

      parsed.sort((a, b) => a.number - b.number);
      setErrors(errs);

      if (parsed.length > 0) {
        setParticipants(parsed);
        setImportCount(parsed.length);
        setShowPreview(true);
      }
    } catch (e) {
      setErrors([{ row: 0, message: `Erro ao processar arquivo: ${String(e)}` }]);
    } finally {
      setIsProcessing(false);
    }
  }, [setParticipants]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const clearAll = () => {
    setParticipants([]);
    setImportCount(0);
    setShowPreview(false);
    setShowAll(false);
    setErrors([]);
    setFileName('');
  };

  const fileImported = importCount > 0 && !isProcessing;

  useEffect(() => { if (chatRegistrationActive) setIsRequestingChat(false); }, [chatRegistrationActive]);

  // Auto-mostra lista quando participantes chegam pelo chat (sem arquivo importado)
  useEffect(() => {
    if (participants.length > 0 && importCount === 0) {
      setShowPreview(true);
    }
  }, [participants.length, importCount]);

  // ── VIEW COMPLETA ────────────────────────────────────────────────────────────
  if (showAll && participants.length > 0) {
    return (
      <div style={{ margin: '0 -14px -24px -14px', display: 'flex', flexDirection: 'column' }}>
        {/* Header sticky */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 16px',
          background: 'rgba(5,8,22,0.98)',
          borderBottom: '1px solid rgba(0,229,255,0.18)',
          backdropFilter: 'blur(8px)',
        }}>
          <button
            onClick={() => setShowAll(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.1em', color: 'rgba(0,229,255,0.75)',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 8px', borderRadius: '6px',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            VOLTAR
          </button>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '11px', color: 'rgba(0,229,255,0.8)', letterSpacing: '0.05em' }}>
            <span style={{ padding: '2px 8px' }}>{participants.length.toLocaleString()}</span> participantes
          </span>
        </div>
        {/* Lista completa */}
        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
          <tbody>
            {participants.map(p => (
              <tr
                key={p.id}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '7px 10px 7px 16px', width: '42px', fontFamily: 'Orbitron, sans-serif', fontSize: '10px', color: 'rgba(0,229,255,0.4)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {p.number}
                </td>
                <td style={{ padding: '7px 16px 7px 0', fontFamily: 'Rajdhani, sans-serif', color: 'rgba(255,255,255,0.72)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      {p.source && <PlatformIcon source={p.source} />}
                      {p.name}
                    </div>
                    {p.source && (
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 6px rgba(0,255,136,0.8)', flexShrink: 0, marginRight: '4px' }} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>

      <AnimatePresence mode="wait">

        {/* ── APÓS IMPORTAR: mostra só o arquivo ── */}
        {fileImported ? (
          <motion.div
            key="imported"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl"
            style={{ background: 'rgba(0,255,163,0.05)', border: '1px solid rgba(0,255,163,0.2)', padding: '24px 28px' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(0,255,163,0.12)', border: '1px solid rgba(0,255,163,0.25)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#00FFA3">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-rajdhani text-xs text-white/35 tracking-widest uppercase mb-0.5">Arquivo importado</p>
                  <p className="font-rajdhani font-bold text-white/80 text-sm">{fileName}</p>
                  <p className="font-orbitron text-neon-green font-bold text-base mt-0.5">
                    <span style={{ padding: '2px 8px' }}>{importCount.toLocaleString()}</span> <span className="font-rajdhani text-white/35 text-xs font-normal">participantes</span>
                  </p>
                </div>
              </div>
              <button
                onClick={clearAll}
                className="font-rajdhani text-xs tracking-widest px-3 py-2 rounded-lg transition-all"
                style={{ color: 'rgba(255,68,68,0.6)', border: '1px solid rgba(255,68,68,0.15)' }}
              >
                TROCAR
              </button>
            </div>
          </motion.div>
        ) : (

          /* ── ANTES DE IMPORTAR: drop zone + opções ── */
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            {/* Drop zone */}
            {!chatRegistrationActive && excelImportEnabled && <motion.div
              className="relative rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300"
              style={{
                padding: '20px 16px',
                borderColor: isDragging ? '#00E5FF' : 'rgba(255,255,255,0.08)',
                background: isDragging ? 'rgba(0,229,255,0.08)' : 'rgba(255,255,255,0.02)',
                boxShadow: isDragging ? '0 0 30px rgba(0,229,255,0.2)' : 'none',
              }}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />

              <AnimatePresence mode="wait">
                {isProcessing ? (
                  <motion.div key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-3">
                    <motion.div
                      className="w-5 h-5 rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                    <span className="font-rajdhani text-neon-cyan text-sm tracking-widest">PROCESSANDO...</span>
                  </motion.div>
                ) : (
                  <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-3">
                    <motion.div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.2)' }}
                      animate={{ y: isDragging ? -3 : [0, -3, 0] }}
                      transition={isDragging ? {} : { duration: 2, repeat: Infinity }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="1.5">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round"/>
                        <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round"/>
                      </svg>
                    </motion.div>
                    <div className="text-left">
                      <p className="font-rajdhani text-white/60 text-sm">
                        {isDragging ? 'Solte o arquivo aqui' : 'Arraste ou clique para importar participantes'}
                      </p>
                      <p className="font-rajdhani text-white/25 text-xs tracking-wider">.XLSX · .XLS · .CSV</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>}

            {/* Add participants box */}
            <div
              className="rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px 24px' }}
            >
              <p className="font-orbitron text-xs text-white/30 tracking-widest uppercase" style={{ marginBottom: '14px' }}>
                Adicionar Participantes
              </p>

              {chatRegistrationActive ? (
                /* Status: chat registration active */
                <div className="space-y-3">
                  <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.3)' }}>
                    <motion.div className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: '#00E5FF', marginLeft: '4px' }}
                      animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.7, repeat: Infinity }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-rajdhani text-xs font-bold tracking-wider" style={{ color: '#00E5FF', lineHeight: 2 }}>
                        BUSCANDO NO CHAT
                      </p>
                      <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 2 }}>
                        Digite{' '}
                        <span className="font-mono font-bold" style={{ color: '#00E5FF' }}>
                          {twitchConfig.registrationCommand || '!entrar'}
                        </span>
                        {' '}pra participar
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setChatRegistrationStopRequested(true)}
                    className="w-full py-2 rounded-xl font-rajdhani font-bold tracking-widest text-xs transition-all"
                    style={{ color: 'rgba(255,68,68,0.7)', border: '1px solid rgba(255,68,68,0.2)', background: 'rgba(255,68,68,0.05)', lineHeight: 2.2, letterSpacing: '0.12em', marginTop: '8px' }}
                  >
                    ENCERRAR INSCRIÇÕES
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <motion.button
                    onClick={() => { setIsRequestingChat(true); setChatRegistrationRequested(true); }}
                    disabled={isRequestingChat}
                    whileHover={!isRequestingChat ? { scale: 1.02 } : {}}
                    whileTap={!isRequestingChat ? { scale: 0.98 } : {}}
                    className="flex-1 py-3 rounded-xl font-rajdhani font-bold tracking-widest text-xs flex items-center justify-center gap-2"
                    style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)', color: '#00E5FF', opacity: isRequestingChat ? 0.6 : 1 }}
                  >
                    {isRequestingChat ? (
                      <span style={{ marginTop: '5px', marginBottom: '5px' }}>CARREGANDO...</span>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                        </svg>
                        <span style={{ marginTop: '5px', marginBottom: '5px' }}>PELO CHAT</span>
                      </>
                    )}
                  </motion.button>

                  <motion.button
                    onClick={() => setActiveTab('games')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 py-3 rounded-xl font-rajdhani font-bold tracking-widest text-xs flex items-center justify-center gap-2"
                    style={{ background: 'rgba(255,102,51,0.08)', border: '1px solid rgba(255,102,51,0.25)', color: '#FF6633' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                      <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5S14.67 12 15.5 12s1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                    </svg>
                    <span style={{ marginTop: '5px', marginBottom: '5px' }}>POR JOGO</span>
                  </motion.button>
                </div>
              )}
            </div>

          </motion.div>
        )}

      </AnimatePresence>

      {/* ── ERRORS ── */}
      <AnimatePresence>
        {errors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl p-4 space-y-1.5"
            style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF4444">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
              <span className="font-rajdhani text-sm font-bold tracking-wider" style={{ color: '#FF4444' }}>
                {errors.length} AVISO{errors.length > 1 ? 'S' : ''}
              </span>
            </div>
            {errors.slice(0, 5).map((err, i) => (
              <p key={i} className="font-rajdhani text-xs" style={{ color: 'rgba(255,68,68,0.8)' }}>
                {err.message}
              </p>
            ))}
            {errors.length > 5 && (
              <p className="font-rajdhani text-xs text-white/25">
                + {errors.length - 5} mais avisos...
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PREVIEW TABLE ── */}
      <AnimatePresence>
        {showPreview && participants.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
          >
            {/* Cabeçalho da tabela */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                background: 'rgba(0,229,255,0.08)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                flexShrink: 0,
              }}
            >
              <span className="font-rajdhani tracking-widest uppercase" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                Participantes
              </span>
              <button
                onClick={() => setShowPreview(false)}
                style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <th style={{ padding: '8px 16px 8px 16px', textAlign: 'left', fontFamily: 'Rajdhani, sans-serif', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                      Nome
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(importCount === 0 ? participants : participants.slice(0, 50)).map(p => (
                    <tr
                      key={p.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '7px 16px', fontFamily: 'Rajdhani, sans-serif', color: 'rgba(255,255,255,0.6)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            {p.source && <PlatformIcon source={p.source} />}
                            {p.name}
                          </div>
                          {p.source && (
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 6px rgba(0,255,136,0.8)', flexShrink: 0, marginRight: '4px' }} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* VER TODOS — fixo no fundo do card, fora do scroll */}
            {participants.length > 50 && (
              <div style={{ flexShrink: 0, padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  onClick={() => setShowAll(true)}
                  style={{
                    width: '100%',
                    padding: '9px 0',
                    borderRadius: '10px',
                    fontFamily: 'Rajdhani, sans-serif',
                    fontWeight: 700,
                    fontSize: '12px',
                    letterSpacing: '0.12em',
                    color: 'rgba(0,229,255,0.75)',
                    background: 'rgba(0,229,255,0.06)',
                    border: '1px solid rgba(0,229,255,0.2)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  VER TODOS ({participants.length.toLocaleString()})
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
                  </svg>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EMPTY STATE (when no file loaded yet) ── */}
      {participants.length === 0 && importCount === 0 && !isProcessing && (
        <div className="text-center py-4">
          <p className="font-rajdhani text-white/20 text-xs tracking-widest">
            Nenhum participante carregado ainda
          </p>
        </div>
      )}
    </div>
  );
}
