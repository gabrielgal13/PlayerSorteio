'use client';
import { motion } from 'framer-motion';

interface StageBaseProps {
  isUrgent?: boolean;
}

export default function StageBase({ isUrgent = false }: StageBaseProps) {
  return (
    <div
      className="absolute bottom-0 left-1/2 pointer-events-none"
      style={{ transform: 'translateX(-50%)', width: '720px', maxWidth: '100%' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <svg
          viewBox="100 380 1400 390"
          width="100%"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            {/* ── Filters ── */}
            <filter id="stageGlow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="14" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <filter id="stageSoftGlow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="6"/>
            </filter>
            <filter id="sbPBlur" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="2.5"/>
            </filter>

            {/* ── Platform gradients ── */}
            <linearGradient id="stageMetal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#183B63"/>
              <stop offset="35%"  stopColor="#071325"/>
              <stop offset="100%" stopColor="#02050C"/>
            </linearGradient>
            <linearGradient id="stageCyan" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#00D1FF"/>
              <stop offset="100%" stopColor="#3D8BFF"/>
            </linearGradient>
            <linearGradient id="stagePurple" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#7B2DFF"/>
              <stop offset="100%" stopColor="#A855F7"/>
            </linearGradient>
            <radialGradient id="stageFloorLight" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#00D1FF" stopOpacity="0.7"/>
              <stop offset="100%" stopColor="#00D1FF" stopOpacity="0"/>
            </radialGradient>

            {/* ── Spotlight gradients ── */}
            <radialGradient id="sbSpotL" cx="50%" cy="0%" r="100%" fx="50%" fy="0%">
              <stop offset="0%"   stopColor="#00FFB2" stopOpacity="0.22"/>
              <stop offset="55%"  stopColor="#00D1FF" stopOpacity="0.06"/>
              <stop offset="100%" stopColor="#00D1FF" stopOpacity="0"/>
            </radialGradient>
            <radialGradient id="sbSpotR" cx="50%" cy="0%" r="100%" fx="50%" fy="0%">
              <stop offset="0%"   stopColor="#00D1FF" stopOpacity="0.22"/>
              <stop offset="55%"  stopColor="#00FFB2" stopOpacity="0.06"/>
              <stop offset="100%" stopColor="#00FFB2" stopOpacity="0"/>
            </radialGradient>

            {/* ── Fog gradient ── */}
            <radialGradient id="sbFog" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#00D1FF" stopOpacity="0.14"/>
              <stop offset="100%" stopColor="#00D1FF" stopOpacity="0"/>
            </radialGradient>

            {/* ── Sweep gradient (horizontal shimmer band) ── */}
            <linearGradient id="sbSweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#ffffff" stopOpacity="0"/>
              <stop offset="42%"  stopColor="#ffffff" stopOpacity="0"/>
              <stop offset="48%"  stopColor="#00D1FF" stopOpacity="0.38"/>
              <stop offset="50%"  stopColor="#ffffff" stopOpacity="0.45"/>
              <stop offset="52%"  stopColor="#00D1FF" stopOpacity="0.38"/>
              <stop offset="58%"  stopColor="#ffffff" stopOpacity="0"/>
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
            </linearGradient>

            {/* ── Clip masks for sweep ── */}
            <clipPath id="sbTopClip">
              <ellipse cx="800" cy="425" rx="225" ry="54"/>
            </clipPath>
            <clipPath id="sbSecClip">
              <ellipse cx="800" cy="525" rx="395" ry="88"/>
            </clipPath>

            {/* ── Urgent red glow ── */}
            <radialGradient id="sbUrgent" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#FF2222" stopOpacity="0.55"/>
              <stop offset="100%" stopColor="#FF2222" stopOpacity="0"/>
            </radialGradient>
          </defs>

          {/* ════════════════════════════════════════════════════════
              LAYER 0 — MOVING SPOTLIGHTS
          ════════════════════════════════════════════════════════ */}

          <ellipse cx="500" cy="430" rx="95" ry="230" fill="url(#sbSpotL)" opacity="0.08">
            <animateTransform attributeName="transform" type="rotate"
              values="-14 500 430; 9 500 430; -14 500 430"
              dur="7s" repeatCount="indefinite" calcMode="spline"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
            <animate attributeName="opacity"
              values="0.08;0.13;0.08" dur="7s" repeatCount="indefinite"/>
          </ellipse>

          <ellipse cx="1100" cy="430" rx="95" ry="230" fill="url(#sbSpotR)" opacity="0.08">
            <animateTransform attributeName="transform" type="rotate"
              values="12 1100 430; -8 1100 430; 12 1100 430"
              dur="9s" repeatCount="indefinite" calcMode="spline"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
            <animate attributeName="opacity"
              values="0.10;0.07;0.10" dur="9s" repeatCount="indefinite"/>
          </ellipse>

          {/* ════════════════════════════════════════════════════════
              LAYER 1 — AMBIENT FOG
          ════════════════════════════════════════════════════════ */}

          <ellipse cx="800" cy="510" rx="490" ry="85" fill="url(#sbFog)" opacity="0.07">
            <animate attributeName="cx" values="775;825;775" dur="10s"
              repeatCount="indefinite" calcMode="spline"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
            <animate attributeName="opacity" values="0.06;0.10;0.06" dur="7s"
              repeatCount="indefinite" calcMode="spline"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
          </ellipse>

          {/* ════════════════════════════════════════════════════════
              LAYER 2 — FLOOR GLOW (pulsing)
          ════════════════════════════════════════════════════════ */}

          <motion.ellipse cx="800" cy="690" rx="620" ry="120"
            fill="url(#stageFloorLight)" filter="url(#stageGlow)"
            animate={{ opacity: isUrgent ? [0.85, 1, 0.85] : [0.6, 0.85, 0.6] }}
            transition={{ duration: isUrgent ? 1.0 : 2.5, repeat: Infinity, ease: 'easeInOut' }}/>

          {/* ════════════════════════════════════════════════════════
              LAYER 3 — OUTER BASE
          ════════════════════════════════════════════════════════ */}

          <ellipse cx="800" cy="600" rx="560" ry="135"
            fill="url(#stageMetal)" stroke="#00D1FF"
            strokeOpacity="0.2" strokeWidth="3"/>
          <path d="M240 600 C240 710 1360 710 1360 600 L1360 650 C1360 770 240 770 240 650 Z"
            fill="url(#stageMetal)"/>

          {/* Outer cyan ring — reacts to urgent */}
          <motion.ellipse cx="800" cy="605" rx="520" ry="118"
            stroke="url(#stageCyan)" fill="none" filter="url(#stageGlow)"
            animate={{
              opacity:      isUrgent ? [0.88, 1, 0.88] : [0.65, 0.9, 0.65],
              strokeWidth:  isUrgent ? 10 : 8,
            }}
            transition={{ duration: isUrgent ? 1.0 : 2.5, repeat: Infinity, ease: 'easeInOut' }}/>

          <ellipse cx="800" cy="618" rx="485" ry="108"
            stroke="url(#stagePurple)" strokeWidth="2" fill="none" opacity="0.8"/>

          {/* ════════════════════════════════════════════════════════
              LAYER 4 — SECOND PLATFORM
          ════════════════════════════════════════════════════════ */}

          <ellipse cx="800" cy="520" rx="420" ry="100" fill="url(#stageMetal)"/>
          <path d="M380 520 C380 610 1220 610 1220 520 L1220 560 C1220 650 380 650 380 560 Z"
            fill="url(#stageMetal)"/>
          <ellipse cx="800" cy="525" rx="395" ry="88"
            stroke="url(#stageCyan)" strokeWidth="7" fill="none" filter="url(#stageGlow)"/>

          {/* Light sweep — second platform, every 6s, offset 2s */}
          <rect x="300" y="437" width="1000" height="176" fill="url(#sbSweep)"
            clipPath="url(#sbSecClip)" opacity="0">
            <animateTransform attributeName="transform" type="translate"
              values="-700 0; 700 0; 700 0; -700 0"
              keyTimes="0;0.42;0.5;1"
              dur="6s" begin="2s" repeatCount="indefinite"/>
            <animate attributeName="opacity"
              values="0;0.9;0.9;0"
              keyTimes="0;0.07;0.93;1"
              dur="6s" begin="2s" repeatCount="indefinite"/>
          </rect>

          {/* ════════════════════════════════════════════════════════
              LAYER 5 — TOP PLATFORM
          ════════════════════════════════════════════════════════ */}

          <ellipse cx="800" cy="420" rx="260" ry="68" fill="url(#stageMetal)"/>
          <path d="M540 420 C540 500 1060 500 1060 420 L1060 470 C1060 550 540 550 540 470 Z"
            fill="url(#stageMetal)"/>

          {/* Top ring — pulsating, reacts to urgent */}
          <motion.ellipse cx="800" cy="425" rx="225" ry="54"
            stroke="url(#stageCyan)" fill="none" filter="url(#stageGlow)"
            animate={{
              opacity:     isUrgent ? [0.9, 1, 0.9]       : [0.8, 1, 0.8],
              strokeWidth: isUrgent ? [10, 13, 10]         : [10, 10, 10],
            }}
            transition={{ duration: isUrgent ? 1.0 : 2.5, repeat: Infinity, ease: 'easeInOut' }}/>

          {/* Light sweep — top platform, every 4s */}
          <rect x="450" y="371" width="700" height="108" fill="url(#sbSweep)"
            clipPath="url(#sbTopClip)" opacity="0">
            <animateTransform attributeName="transform" type="translate"
              values="-400 0; 400 0; 400 0; -400 0"
              keyTimes="0;0.42;0.5;1"
              dur="4s" repeatCount="indefinite"/>
            <animate attributeName="opacity"
              values="0;0.9;0.9;0"
              keyTimes="0;0.07;0.93;1"
              dur="4s" repeatCount="indefinite"/>
          </rect>

          {/* Top inner */}
          <ellipse cx="800" cy="400" rx="170" ry="40" fill="#0B3556" opacity="0.7"/>

          {/* ════════════════════════════════════════════════════════
              LAYER 6 — LIGHT DOTS
          ════════════════════════════════════════════════════════ */}

          <motion.circle cx="640" cy="505" r="8" fill="#00D1FF" filter="url(#stageGlow)"
            animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.8, repeat: Infinity, delay: 0 }}/>
          <motion.circle cx="800" cy="525" r="8" fill="#00D1FF" filter="url(#stageGlow)"
            animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}/>
          <motion.circle cx="960" cy="505" r="8" fill="#00D1FF" filter="url(#stageGlow)"
            animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.8, repeat: Infinity, delay: 0.6 }}/>
          <motion.circle cx="500" cy="615" r="8" fill="#00D1FF" filter="url(#stageGlow)"
            animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.8, repeat: Infinity, delay: 0.9 }}/>
          <motion.circle cx="1100" cy="615" r="8" fill="#00D1FF" filter="url(#stageGlow)"
            animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.8, repeat: Infinity, delay: 1.2 }}/>

          {/* ════════════════════════════════════════════════════════
              LAYER 7 — FLOATING PARTICLES
          ════════════════════════════════════════════════════════ */}

          <circle cx="680" cy="450" r="3" fill="#00D1FF" filter="url(#sbPBlur)" opacity="0">
            <animate attributeName="cy" values="450;400;450" dur="3.5s"
              repeatCount="indefinite" calcMode="spline"
              keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
            <animate attributeName="opacity" values="0;0.65;0.4;0"
              keyTimes="0;0.15;0.85;1" dur="3.5s" repeatCount="indefinite"/>
          </circle>

          <circle cx="860" cy="442" r="2" fill="#00FFB2" filter="url(#sbPBlur)" opacity="0">
            <animate attributeName="cy" values="442;398;442" dur="4.2s" begin="0.8s"
              repeatCount="indefinite" calcMode="spline"
              keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
            <animate attributeName="opacity" values="0;0.55;0.35;0"
              keyTimes="0;0.2;0.8;1" dur="4.2s" begin="0.8s" repeatCount="indefinite"/>
          </circle>

          <circle cx="745" cy="447" r="2.5" fill="#00D1FF" filter="url(#sbPBlur)" opacity="0">
            <animate attributeName="cy" values="447;395;447" dur="3.8s" begin="1.5s"
              repeatCount="indefinite" calcMode="spline"
              keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
            <animate attributeName="opacity" values="0;0.6;0.4;0"
              keyTimes="0;0.15;0.85;1" dur="3.8s" begin="1.5s" repeatCount="indefinite"/>
          </circle>

          <circle cx="930" cy="455" r="2" fill="#3D8BFF" filter="url(#sbPBlur)" opacity="0">
            <animate attributeName="cy" values="455;408;455" dur="4.5s" begin="2.3s"
              repeatCount="indefinite" calcMode="spline"
              keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
            <animate attributeName="opacity" values="0;0.5;0.3;0"
              keyTimes="0;0.2;0.8;1" dur="4.5s" begin="2.3s" repeatCount="indefinite"/>
          </circle>

          <circle cx="720" cy="432" r="2" fill="#00FFB2" filter="url(#sbPBlur)" opacity="0">
            <animate attributeName="cy" values="432;386;432" dur="3.2s" begin="3.0s"
              repeatCount="indefinite" calcMode="spline"
              keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
            <animate attributeName="opacity" values="0;0.55;0.35;0"
              keyTimes="0;0.2;0.8;1" dur="3.2s" begin="3.0s" repeatCount="indefinite"/>
          </circle>

          {/* ════════════════════════════════════════════════════════
              LAYER 8 — SCI-FI ACCENT DETAILS
          ════════════════════════════════════════════════════════ */}

          <rect x="430" y="595" width="50" height="8" rx="4"
            fill="#00D1FF" filter="url(#stageSoftGlow)"/>
          <rect x="1120" y="595" width="50" height="8" rx="4"
            fill="#00D1FF" filter="url(#stageSoftGlow)"/>

          {/* ════════════════════════════════════════════════════════
              LAYER 9 — FRONT SHADOW
          ════════════════════════════════════════════════════════ */}

          <ellipse cx="800" cy="760" rx="420" ry="40" fill="#000" opacity="0.45"/>

          {/* ════════════════════════════════════════════════════════
              LAYER 10 — URGENT RED OVERLAY
          ════════════════════════════════════════════════════════ */}

          <motion.ellipse cx="800" cy="510" rx="500" ry="130"
            fill="url(#sbUrgent)"
            filter="url(#stageGlow)"
            initial={{ opacity: 0 }}
            animate={{ opacity: isUrgent ? 0.4 : 0 }}
            transition={{ duration: 0.5 }}/>

        </svg>
      </motion.div>
    </div>
  );
}
