'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MarketingImage {
  id: number;
  imageData: string;
  label: string | null;
  active: boolean;
  order: number;
  createdAt: string;
}

export default function MarketingSection() {
  const [images, setImages] = useState<MarketingImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/marketing');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}: ${res.statusText}`);
      setImages(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar imagens');
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchImages(); }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreviewSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!previewSrc) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch('/api/admin/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: previewSrc, label: labelInput || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Erro ${res.status}`);
      }
      setPreviewSrc(null);
      setLabelInput('');
      if (fileRef.current) fileRef.current.value = '';
      await fetchImages();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Erro ao enviar imagem');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (img: MarketingImage) => {
    await fetch(`/api/admin/marketing/${img.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !img.active }),
    });
    setImages(prev => prev.map(i => i.id === img.id ? { ...i, active: !i.active } : i));
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remover esta imagem?')) return;
    await fetch(`/api/admin/marketing/${id}`, { method: 'DELETE' });
    setImages(prev => prev.filter(i => i.id !== id));
  };

  const cancelPreview = () => {
    setPreviewSrc(null);
    setLabelInput('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#00E5FF">
            <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-5-7l-3 3.72L11 13l-4 5h14l-4-5z"/>
          </svg>
        </div>
        <div>
          <h2 className="font-orbitron font-bold text-base tracking-widest text-white">MARKETING</h2>
          <p className="font-rajdhani text-xs text-white/40 tracking-widest mt-0.5">
            Imagens exibidas aleatoriamente no Stage 1
          </p>
        </div>
        <div className="ml-auto">
          <span className="font-orbitron text-xs px-3 py-1 rounded-lg"
            style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', color: 'rgba(0,229,255,0.7)' }}>
            {images.filter(i => i.active).length} ativas / {images.length} total
          </span>
        </div>
      </div>

      {/* Upload area */}
      <div className="rounded-2xl p-6 mb-8"
        style={{ background: 'rgba(8,8,17,0.6)', border: '1px solid rgba(0,229,255,0.15)' }}>
        <div className="flex items-center gap-2 mb-5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(0,229,255,0.7)">
            <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/>
          </svg>
          <span className="font-orbitron text-xs font-bold tracking-widest" style={{ color: 'rgba(0,229,255,0.7)' }}>
            ADICIONAR IMAGEM
          </span>
        </div>

        {!previewSrc ? (
          <label
            className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-all"
            style={{
              height: 160,
              border: '2px dashed rgba(0,229,255,0.2)',
              background: 'rgba(0,229,255,0.03)',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLLabelElement).style.borderColor = 'rgba(0,229,255,0.4)'}
            onMouseLeave={e => (e.currentTarget as HTMLLabelElement).style.borderColor = 'rgba(0,229,255,0.2)'}
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(0,229,255,0.35)">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
            </svg>
            <span className="font-rajdhani text-sm tracking-widest" style={{ color: 'rgba(0,229,255,0.5)' }}>
              Clique para selecionar uma imagem
            </span>
            <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
              PNG, JPG, GIF, WebP
            </span>
          </label>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-5 items-start"
            >
              {/* Preview */}
              <div className="flex-shrink-0 rounded-xl overflow-hidden"
                style={{ width: 180, height: 120, border: '1px solid rgba(0,229,255,0.25)', background: '#000' }}>
                <img src={previewSrc} alt="preview" className="w-full h-full object-contain" />
              </div>

              {/* Form */}
              <div className="flex-1 flex flex-col gap-3">
                <div>
                  <label className="block font-rajdhani text-xs tracking-widest text-white/40 uppercase mb-1.5">
                    Label (opcional)
                  </label>
                  <input
                    type="text"
                    value={labelInput}
                    onChange={e => setLabelInput(e.target.value)}
                    placeholder="Ex: PlayerSkins WEAR — Maio 2025"
                    className="input-neon w-full px-3 py-2 rounded-lg font-rajdhani text-sm"
                  />
                </div>
                <div className="flex gap-3 mt-1">
                  <motion.button
                    onClick={handleUpload}
                    disabled={uploading}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-orbitron font-bold text-xs tracking-widest disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, #00E5FF, #1F8CFF)',
                      color: '#050816',
                    }}
                  >
                    {uploading ? (
                      <motion.span className="inline-block w-3 h-3 border-2 border-current/30 border-t-current rounded-full"
                        animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                      </svg>
                    )}
                    {uploading ? 'ENVIANDO...' : 'ADICIONAR'}
                  </motion.button>
                  <button
                    onClick={cancelPreview}
                    className="px-4 py-2.5 rounded-xl font-orbitron text-xs tracking-widest"
                    style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', color: '#FF4444' }}
                  >
                    CANCELAR
                  </button>
                </div>
                {uploadError && (
                  <span className="font-rajdhani text-xs mt-1" style={{ color: '#FF4444' }}>{uploadError}</span>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Images grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <motion.div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full"
            animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <span className="font-rajdhani text-sm tracking-widest" style={{ color: '#FF4444' }}>{error}</span>
          <button onClick={fetchImages} className="font-orbitron text-xs px-4 py-2 rounded-lg"
            style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)', color: 'rgba(0,229,255,0.7)' }}>
            TENTAR NOVAMENTE
          </button>
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-16">
          <span className="font-rajdhani text-sm tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Nenhuma imagem cadastrada
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <AnimatePresence>
            {images.map(img => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="rounded-xl overflow-hidden flex flex-col"
                style={{
                  border: img.active
                    ? '1px solid rgba(0,229,255,0.3)'
                    : '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(8,8,17,0.6)',
                  opacity: img.active ? 1 : 0.5,
                }}
              >
                {/* Image */}
                <div className="relative" style={{ height: 130, background: '#000' }}>
                  <img src={img.imageData} alt={img.label ?? ''} className="w-full h-full object-contain" />
                  {!img.active && (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.6)' }}>
                      <span className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        DESATIVADA
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 flex flex-col gap-2">
                  {img.label && (
                    <span className="font-rajdhani text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {img.label}
                    </span>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleActive(img)}
                      className="flex-1 py-1.5 rounded-lg font-rajdhani text-xs tracking-widest font-bold transition-all"
                      style={{
                        background: img.active ? 'rgba(0,255,163,0.1)' : 'rgba(0,229,255,0.08)',
                        border: img.active ? '1px solid rgba(0,255,163,0.3)' : '1px solid rgba(0,229,255,0.2)',
                        color: img.active ? '#00FFA3' : 'rgba(0,229,255,0.6)',
                      }}
                    >
                      {img.active ? 'ATIVA' : 'ATIVAR'}
                    </button>
                    <button
                      onClick={() => handleDelete(img.id)}
                      className="px-3 py-1.5 rounded-lg transition-all"
                      style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', color: 'rgba(255,68,68,0.7)' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
