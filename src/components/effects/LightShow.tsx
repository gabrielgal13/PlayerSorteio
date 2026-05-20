'use client';
import { motion, AnimatePresence } from 'framer-motion';

const BEAMS = [
  { baseAngle: -55, color: '#00E5FF', opacity: 0.55, sweep: 11, duration: 3.1, delay: 0 },
  { baseAngle: -28, color: '#FFD166', opacity: 0.60, sweep: 9,  duration: 2.7, delay: 0.40 },
  { baseAngle:  -5, color: '#FF6B9D', opacity: 0.50, sweep: 8,  duration: 3.8, delay: 0.80 },
  { baseAngle:  18, color: '#00FFA3', opacity: 0.55, sweep: 10, duration: 2.4, delay: 0.20 },
  { baseAngle:  40, color: '#1F8CFF', opacity: 0.60, sweep: 9,  duration: 3.3, delay: 0.60 },
  { baseAngle:  62, color: '#A855F7', opacity: 0.50, sweep: 8,  duration: 2.9, delay: 1.00 },
] as const;

export default function LightShow({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="lightshow"
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ zIndex: 15 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
        >
          {BEAMS.map((beam, i) => (
            <motion.div
              key={i}
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                width: '58%',
                height: '95%',
                marginLeft: '-29%',
                transformOrigin: '50% 0%',
                background: `linear-gradient(180deg,
                  rgba(255,255,255,0.98) 0%,
                  ${beam.color}EE 5%,
                  ${beam.color}80 38%,
                  ${beam.color}28 72%,
                  transparent 100%)`,
                clipPath: 'polygon(47% 0%, 53% 0%, 100% 100%, 0% 100%)',
                mixBlendMode: 'screen',
              }}
              animate={{
                rotate: [
                  beam.baseAngle - beam.sweep,
                  beam.baseAngle + beam.sweep,
                  beam.baseAngle - beam.sweep * 0.55,
                  beam.baseAngle + beam.sweep * 0.8,
                  beam.baseAngle - beam.sweep,
                ],
                opacity: [
                  beam.opacity * 0.35,
                  beam.opacity,
                  beam.opacity * 0.62,
                  beam.opacity * 0.88,
                  beam.opacity * 0.35,
                ],
              }}
              transition={{
                duration: beam.duration,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: beam.delay,
              }}
            />
          ))}

          {/* Bright origin glow at top center — the "light source" point */}
          <motion.div
            style={{
              position: 'absolute',
              top: '-28px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '160px',
              height: '160px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.65) 22%, rgba(255,255,255,0.15) 52%, transparent 72%)',
              mixBlendMode: 'screen',
              filter: 'blur(8px)',
            }}
            animate={{
              scale:   [0.85, 1.45, 1.0, 1.32, 0.85],
              opacity: [0.55, 1.0,  0.7, 0.92, 0.55],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
