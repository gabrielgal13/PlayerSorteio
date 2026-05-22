'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MarketingImageData {
  id: number;
  imageData: string;
  label: string | null;
}

export default function MarketingBanner() {
  const [image, setImage] = useState<MarketingImageData | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    fetch('/api/marketing/random')
      .then(r => r.json())
      .then(data => { if (data) setImage(data); })
      .catch(() => {});
  }, []);

  if (!image) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="relative flex items-center rounded-xl overflow-hidden"
          style={{
            background: 'rgba(5,8,22,0.85)',
            border: '1px solid rgba(0,229,255,0.15)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            height: 72,
            minWidth: 0,
            flexShrink: 0,
          }}
        >
          {/* Left accent */}
          <div style={{ width: 2, alignSelf: 'stretch', background: 'linear-gradient(180deg, rgba(0,229,255,0.6), rgba(0,229,255,0.1))', flexShrink: 0 }} />

          {/* Image slot */}
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 80,
              height: '100%',
              background: 'rgba(0,229,255,0.04)',
              borderRight: '1px solid rgba(0,229,255,0.1)',
            }}
          >
            <img
              src={image.imageData}
              alt={image.label ?? 'marketing'}
              style={{ maxWidth: 68, maxHeight: 60, objectFit: 'contain' }}
            />
          </div>

          {/* Label area */}
          {image.label && (
            <div className="flex-1 px-4 min-w-0">
              <span className="font-rajdhani text-xs tracking-widest block truncate"
                style={{ color: 'rgba(255,255,255,0.55)' }}>
                {image.label}
              </span>
            </div>
          )}

          {/* Close */}
          <button
            onClick={() => setVisible(false)}
            className="flex-shrink-0 mr-3 flex items-center justify-center rounded-md transition-all"
            style={{ width: 22, height: 22, color: 'rgba(255,255,255,0.2)' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.2)'}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
