'use client';
import { motion } from 'framer-motion';
import { useStore } from '@/store/useStore';

interface StageBaseProps {
  isUrgent?: boolean;
}

export default function StageBase({ isUrgent = false }: StageBaseProps) {
  const { themeColor } = useStore();
  const c = themeColor ?? '#00E5FF';

  return (
    <div
      className="absolute bottom-0 left-1/2 pointer-events-none"
      style={{ transform: 'translateX(-50%) translateY(60px) scaleY(0.75)', transformOrigin: 'bottom center', width: '720px', maxWidth: '100%' }}
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
            {/* FILTERS — Apple Vision Pro / Tron Legacy: controlled bloom, sharp core */}
            <filter id="sb_huge" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="18"/>
            </filter>
            <filter id="sb_big" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5"/>
            </filter>
            <filter id="sb_med" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5"/>
            </filter>
            <filter id="sb_soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.6"/>
            </filter>
            <filter id="sb_tiny" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.9"/>
            </filter>

            {/* Top face — radial darker at edges, faint cyan center */}
            <radialGradient id="sb_top_face" cx="50%" cy="50%" r="60%">
              <stop offset="0%"  stopColor="#0d1a2e"/>
              <stop offset="55%" stopColor="#040912"/>
              <stop offset="100%" stopColor="#01030A"/>
            </radialGradient>

            {/* Side wall — heavy metal gradient: cyan tint top → deep black weight → faint cyan reflection */}
            <linearGradient id="sb_side_wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#0b1a32"/>
              <stop offset="20%" stopColor="#040b18"/>
              <stop offset="65%" stopColor="#01030a"/>
              <stop offset="100%" stopColor="#020812"/>
            </linearGradient>

            {/* Base tier side wall — even heavier/darker */}
            <linearGradient id="sb_base_wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#091830"/>
              <stop offset="18%" stopColor="#030915"/>
              <stop offset="60%" stopColor="#010206"/>
              <stop offset="100%" stopColor="#000104"/>
            </linearGradient>

            {/* Deep well — reactor depression at center of elevator pad */}
            <radialGradient id="sb_well" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#000206" stopOpacity="1"/>
              <stop offset="55%"  stopColor="#02060e" stopOpacity="0.95"/>
              <stop offset="100%" stopColor={c}      stopOpacity="0.18"/>
            </radialGradient>

            {/* Glossy top face highlight — subtle bright crescent on top of each tier */}
            <radialGradient id="sb_glossy" cx="50%" cy="25%" r="50%">
              <stop offset="0%"   stopColor="#fff" stopOpacity="0.13"/>
              <stop offset="55%"  stopColor="#fff" stopOpacity="0.04"/>
              <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
            </radialGradient>

            {/* Floor mirror — vertical gradient for premium black-mirror floor reflection */}
            <linearGradient id="sb_mirror" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={c} stopOpacity="0.32"/>
              <stop offset="40%"  stopColor={c} stopOpacity="0.08"/>
              <stop offset="100%" stopColor={c} stopOpacity="0"/>
            </linearGradient>

            {/* Floor halo — wide soft glow under stage */}
            <radialGradient id="sb_floor_halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor={c} stopOpacity="0.55"/>
              <stop offset="42%" stopColor={c} stopOpacity="0.22"/>
              <stop offset="100%" stopColor={c} stopOpacity="0"/>
            </radialGradient>

            {/* Drop shadow under stage — separates stage from floor */}
            <radialGradient id="sb_drop_shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#000" stopOpacity="0.95"/>
              <stop offset="55%"  stopColor="#000" stopOpacity="0.5"/>
              <stop offset="100%" stopColor="#000" stopOpacity="0"/>
            </radialGradient>

            {/* Spotlight cones */}
            <radialGradient id="sb_spotL" cx="50%" cy="0%" r="100%" fx="50%" fy="0%">
              <stop offset="0%"   stopColor={c} stopOpacity="0.22"/>
              <stop offset="100%" stopColor={c} stopOpacity="0"/>
            </radialGradient>
            <radialGradient id="sb_spotR" cx="50%" cy="0%" r="100%" fx="50%" fy="0%">
              <stop offset="0%"   stopColor={c} stopOpacity="0.18"/>
              <stop offset="100%" stopColor={c} stopOpacity="0"/>
            </radialGradient>

            {/* Fog */}
            <radialGradient id="sb_fog" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={c} stopOpacity="0.13"/>
              <stop offset="100%" stopColor={c} stopOpacity="0"/>
            </radialGradient>

            {/* Sweep shimmer */}
            <linearGradient id="sb_sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#fff" stopOpacity="0"/>
              <stop offset="44%"  stopColor="#fff" stopOpacity="0"/>
              <stop offset="48%"  stopColor={c}    stopOpacity="0.5"/>
              <stop offset="50%"  stopColor="#fff" stopOpacity="0.7"/>
              <stop offset="52%"  stopColor={c}    stopOpacity="0.5"/>
              <stop offset="56%"  stopColor="#fff" stopOpacity="0"/>
              <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
            </linearGradient>

            {/* Holographic elevator core glow */}
            <radialGradient id="sb_core_glow" cx="50%" cy="60%" r="50%">
              <stop offset="0%"   stopColor={c} stopOpacity="0.85"/>
              <stop offset="38%"  stopColor={c} stopOpacity="0.4"/>
              <stop offset="100%" stopColor={c} stopOpacity="0"/>
            </radialGradient>

            {/* Vertical light beam */}
            <linearGradient id="sb_beam" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%"   stopColor={c}    stopOpacity="0.95"/>
              <stop offset="55%"  stopColor={c}    stopOpacity="0.35"/>
              <stop offset="100%" stopColor={c}    stopOpacity="0"/>
            </linearGradient>

            <clipPath id="sb_topClip">
              <ellipse cx="800" cy="425" rx="245" ry="68"/>
            </clipPath>
            <clipPath id="sb_midClip">
              <ellipse cx="800" cy="522" rx="402" ry="98"/>
            </clipPath>

            {/* Urgent red */}
            <radialGradient id="sb_urgent" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#FF2020" stopOpacity="0.7"/>
              <stop offset="100%" stopColor="#FF2020" stopOpacity="0"/>
            </radialGradient>
          </defs>

          {/* ═══════════════════════════════════ */}
          {/* 1. BACKGROUND ATMOSPHERE           */}
          {/* ═══════════════════════════════════ */}

          {/* Far fog */}
          <ellipse cx="800" cy="500" rx="680" ry="95" fill="url(#sb_fog)" opacity="0.45">
            <animate attributeName="cx" values="780;820;780" dur="11s"
              repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
            <animate attributeName="opacity" values="0.3;0.55;0.3" dur="8s" repeatCount="indefinite"/>
          </ellipse>

          {/* Spotlights from above */}
          <ellipse cx="470" cy="430" rx="80" ry="220" fill="url(#sb_spotL)" opacity="0.09">
            <animateTransform attributeName="transform" type="rotate"
              values="-14 470 510;10 470 510;-14 470 510"
              dur="8s" repeatCount="indefinite" calcMode="spline"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
            <animate attributeName="opacity" values="0.07;0.13;0.07" dur="8s" repeatCount="indefinite"/>
          </ellipse>
          <ellipse cx="1130" cy="430" rx="80" ry="220" fill="url(#sb_spotR)" opacity="0.09">
            <animateTransform attributeName="transform" type="rotate"
              values="12 1130 510;-9 1130 510;12 1130 510"
              dur="10s" repeatCount="indefinite" calcMode="spline"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
            <animate attributeName="opacity" values="0.09;0.07;0.09" dur="10s" repeatCount="indefinite"/>
          </ellipse>

          {/* ═══════════════════════════════════ */}
          {/* 2. FLOATING EFFECT (palco flutua)  */}
          {/* ═══════════════════════════════════ */}

          {/* Wide diffuse floor halo */}
          <ellipse cx="800" cy="750" rx="720" ry="58" fill="url(#sb_floor_halo)" filter="url(#sb_huge)">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="3.5s" repeatCount="indefinite"/>
          </ellipse>

          {/* Floor mirror reflection — stretched cyan below stage (black-mirror floor) */}
          <ellipse cx="800" cy="785" rx="540" ry="35" fill="url(#sb_floor_halo)" filter="url(#sb_huge)" opacity="0.55">
            <animate attributeName="opacity" values="0.4;0.7;0.4" dur="4s" repeatCount="indefinite"/>
          </ellipse>
          <ellipse cx="800" cy="775" rx="420" ry="22" fill={c} opacity="0.18" filter="url(#sb_big)"/>

          {/* Cyan ground reflection — narrow strip below stage */}
          <ellipse cx="800" cy="748" rx="520" ry="14" fill={c} opacity="0.32" filter="url(#sb_big)">
            <animate attributeName="opacity" values="0.22;0.42;0.22" dur="3.2s" repeatCount="indefinite"/>
          </ellipse>
          <ellipse cx="800" cy="748" rx="350" ry="8" fill={c} opacity="0.55" filter="url(#sb_med)">
            <animate attributeName="opacity" values="0.4;0.7;0.4" dur="3s" repeatCount="indefinite"/>
          </ellipse>

          {/* Sharp mirror line — bright horizontal where stage meets floor */}
          <rect x="320" y="717" width="960" height="0.8" fill={c} opacity="0.7" filter="url(#sb_tiny)"/>
          <rect x="410" y="717.4" width="780" height="0.5" fill="#fff" opacity="0.4"/>

          {/* Drop shadow on ground (separation from floor) */}
          <ellipse cx="800" cy="722" rx="500" ry="16" fill="url(#sb_drop_shadow)" opacity="0.9"/>
          <ellipse cx="800" cy="720" rx="360" ry="9" fill="#000" opacity="0.6"/>

          {/* ═══════════════════════════════════ */}
          {/* 3. BASE TIER (largest, bottom)     */}
          {/* ═══════════════════════════════════ */}

          {/* Side wall: heavier base — uses sb_base_wall (denser metal) */}
          <path d="M 260 600
                   C 260 712 1340 712 1340 600
                   L 1340 655
                   C 1340 720 260 720 260 655 Z"
            fill="url(#sb_base_wall)"/>

          {/* Base panel segment dividers — sci-fi mechanical separations */}
          <g opacity="0.32">
            <line x1="500" y1="660" x2="500" y2="710" stroke="#000" strokeWidth="1.2"/>
            <line x1="650" y1="660" x2="650" y2="712" stroke="#000" strokeWidth="1.2"/>
            <line x1="800" y1="660" x2="800" y2="715" stroke="#000" strokeWidth="1.4"/>
            <line x1="950" y1="660" x2="950" y2="712" stroke="#000" strokeWidth="1.2"/>
            <line x1="1100" y1="660" x2="1100" y2="710" stroke="#000" strokeWidth="1.2"/>
          </g>
          <g opacity="0.2">
            <line x1="500" y1="660" x2="500" y2="710" stroke={c} strokeWidth="0.4"/>
            <line x1="650" y1="660" x2="650" y2="712" stroke={c} strokeWidth="0.4"/>
            <line x1="800" y1="660" x2="800" y2="715" stroke={c} strokeWidth="0.4"/>
            <line x1="950" y1="660" x2="950" y2="712" stroke={c} strokeWidth="0.4"/>
            <line x1="1100" y1="660" x2="1100" y2="710" stroke={c} strokeWidth="0.4"/>
          </g>

          {/* Mid horizontal reflection band — material catching ambient cyan light */}
          <path d="M 275 622 C 275 678 1325 678 1325 622"
            stroke={c} strokeWidth="0.9" fill="none" opacity="0.32" filter="url(#sb_tiny)"/>

          {/* Bottom edge cyan reflection (light from floor halo hitting cylinder bottom) */}
          <path d="M 268 657 C 268 712 1332 712 1332 657"
            stroke={c} strokeWidth="2.6" fill="none" opacity="0.7" filter="url(#sb_med)"/>
          <path d="M 296 670 C 296 712 1304 712 1304 670"
            stroke={c} strokeWidth="1.3" fill="none" opacity="0.6"/>
          <path d="M 340 682 C 340 708 1260 708 1260 682"
            stroke="#fff" strokeWidth="0.6" fill="none" opacity="0.25"/>

          {/* Ambient occlusion at base of cylinder — sharp seam + soft spread */}
          <ellipse cx="800" cy="700" rx="510" ry="20" fill="#000" opacity="0.55" filter="url(#sb_big)"/>
          <ellipse cx="800" cy="708" rx="495" ry="6" fill="#000" opacity="0.75"/>

          {/* Top face */}
          <ellipse cx="800" cy="600" rx="540" ry="108" fill="url(#sb_top_face)"/>
          {/* Glossy reflection — bright crescent on upper portion (overhead light reflection) */}
          <ellipse cx="800" cy="600" rx="540" ry="108" fill="url(#sb_glossy)"/>
          <ellipse cx="800" cy="600" rx="510" ry="98" stroke={c} strokeWidth="0.7" fill="none" opacity="0.15"/>

          {/* Top neon rim — finer halo, more defined core (base is heavy, less glow) */}
          <motion.ellipse cx="800" cy="601" rx="540" ry="108"
            stroke={c} strokeWidth="8" fill="none" filter="url(#sb_big)"
            animate={{ opacity: isUrgent ? [0.6, 0.85, 0.6] : [0.4, 0.62, 0.4] }}
            transition={{ duration: isUrgent ? 1.0 : 2.8, repeat: Infinity, ease: 'easeInOut' }}/>
          <motion.ellipse cx="800" cy="601" rx="540" ry="108"
            stroke={c} strokeWidth="2.8" fill="none" filter="url(#sb_med)"
            animate={{ opacity: isUrgent ? [0.85, 1, 0.85] : [0.72, 1, 0.72] }}
            transition={{ duration: isUrgent ? 1.0 : 2.8, repeat: Infinity, ease: 'easeInOut' }}/>
          <ellipse cx="800" cy="601" rx="540" ry="108" stroke={c} strokeWidth="1.6" fill="none" opacity="1"/>
          <ellipse cx="800" cy="601" rx="540" ry="108" stroke="#fff" strokeWidth="0.5" fill="none" opacity="0.8"/>

          {/* Tech details on base side wall — hex clusters */}
          <g opacity="0.6">
            <polygon points="345,665 354,660 363,665 363,675 354,680 345,675"
              fill="none" stroke={c} strokeWidth="0.7"/>
            <polygon points="365,672 372,668 379,672 379,680 372,684 365,680"
              fill="none" stroke={c} strokeWidth="0.5"/>
            <polygon points="1237,665 1246,660 1255,665 1255,675 1246,680 1237,675"
              fill="none" stroke={c} strokeWidth="0.7"/>
            <polygon points="1221,672 1228,668 1235,672 1235,680 1228,684 1221,680"
              fill="none" stroke={c} strokeWidth="0.5"/>
          </g>

          {/* HUD micro panels with cyan borders */}
          <g opacity="0.55">
            <rect x="395" y="666" width="38" height="14" rx="1.5"
              fill="#020610" stroke={c} strokeWidth="0.5"/>
            <line x1="398" y1="670" x2="408" y2="670" stroke={c} strokeWidth="0.5" opacity="0.85"/>
            <line x1="398" y1="673" x2="412" y2="673" stroke={c} strokeWidth="0.4" opacity="0.6"/>
            <line x1="398" y1="676" x2="406" y2="676" stroke={c} strokeWidth="0.4" opacity="0.5"/>
            <rect x="1167" y="666" width="38" height="14" rx="1.5"
              fill="#020610" stroke={c} strokeWidth="0.5"/>
            <line x1="1192" y1="670" x2="1202" y2="670" stroke={c} strokeWidth="0.5" opacity="0.85"/>
            <line x1="1188" y1="673" x2="1202" y2="673" stroke={c} strokeWidth="0.4" opacity="0.6"/>
            <line x1="1194" y1="676" x2="1202" y2="676" stroke={c} strokeWidth="0.4" opacity="0.5"/>
          </g>

          {/* Tick mark rows — data/scan markers */}
          <g opacity="0.5">
            <rect x="545" y="668" width="1" height="8" fill={c}/>
            <rect x="552" y="670" width="1" height="6" fill={c}/>
            <rect x="559" y="668" width="1" height="8" fill={c}/>
            <rect x="566" y="671" width="1" height="5" fill={c}/>
            <rect x="573" y="668" width="1" height="8" fill={c}/>
            <rect x="1026" y="668" width="1" height="8" fill={c}/>
            <rect x="1033" y="671" width="1" height="5" fill={c}/>
            <rect x="1040" y="668" width="1" height="8" fill={c}/>
            <rect x="1047" y="670" width="1" height="6" fill={c}/>
            <rect x="1054" y="668" width="1" height="8" fill={c}/>
          </g>

          {/* Base side LED indicators (asymmetric: extra LED on left side only) */}
          <motion.circle cx="450" cy="665" r="2.5" fill={c} filter="url(#sb_tiny)"
            animate={{ opacity: [0.45, 1, 0.45] }} transition={{ duration: 2.0, repeat: Infinity, delay: 0 }}/>
          <motion.circle cx="480" cy="672" r="2" fill={c} filter="url(#sb_tiny)"
            animate={{ opacity: [0.35, 0.9, 0.35] }} transition={{ duration: 2.3, repeat: Infinity, delay: 0.3 }}/>
          <motion.circle cx="464" cy="680" r="1.4" fill={c} filter="url(#sb_tiny)"
            animate={{ opacity: [0.3, 0.75, 0.3] }} transition={{ duration: 2.6, repeat: Infinity, delay: 1.4 }}/>
          <motion.circle cx="1150" cy="665" r="2.5" fill={c} filter="url(#sb_tiny)"
            animate={{ opacity: [0.45, 1, 0.45] }} transition={{ duration: 2.0, repeat: Infinity, delay: 1.1 }}/>
          <motion.circle cx="1120" cy="672" r="2" fill={c} filter="url(#sb_tiny)"
            animate={{ opacity: [0.35, 0.9, 0.35] }} transition={{ duration: 2.3, repeat: Infinity, delay: 0.7 }}/>

          {/* ═══════════════════════════════════ */}
          {/* 4. MIDDLE TIER                     */}
          {/* ═══════════════════════════════════ */}

          {/* Side wall */}
          <path d="M 405 515
                   C 405 595 1195 595 1195 515
                   L 1195 555
                   C 1195 620 405 620 405 555 Z"
            fill="url(#sb_side_wall)"/>

          {/* Mid horizontal reflection band */}
          <path d="M 416 530 C 416 582 1184 582 1184 530"
            stroke={c} strokeWidth="0.8" fill="none" opacity="0.3" filter="url(#sb_tiny)"/>

          {/* Cyan bottom edge reflection */}
          <path d="M 414 557 C 414 605 1186 605 1186 557"
            stroke={c} strokeWidth="2" fill="none" opacity="0.7" filter="url(#sb_med)"/>
          <path d="M 440 568 C 440 602 1160 602 1160 568"
            stroke={c} strokeWidth="1" fill="none" opacity="0.6"/>
          <path d="M 470 578 C 470 598 1130 598 1130 578"
            stroke="#fff" strokeWidth="0.5" fill="none" opacity="0.22"/>

          {/* Ambient occlusion — sharp seam + soft spread */}
          <ellipse cx="800" cy="595" rx="380" ry="14" fill="#000" opacity="0.6" filter="url(#sb_med)"/>
          <ellipse cx="800" cy="582" rx="372" ry="4.5" fill="#000" opacity="0.7"/>

          {/* Top face */}
          <ellipse cx="800" cy="515" rx="395" ry="88" fill="url(#sb_top_face)"/>
          {/* Glossy reflection */}
          <ellipse cx="800" cy="515" rx="395" ry="88" fill="url(#sb_glossy)"/>
          <ellipse cx="800" cy="515" rx="370" ry="80" stroke={c} strokeWidth="0.7" fill="none" opacity="0.15"/>

          {/* Top neon rim */}
          <motion.ellipse cx="800" cy="516" rx="395" ry="88"
            stroke={c} strokeWidth="7.5" fill="none" filter="url(#sb_big)"
            animate={{ opacity: isUrgent ? [0.65, 0.92, 0.65] : [0.45, 0.7, 0.45] }}
            transition={{ duration: isUrgent ? 1.0 : 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}/>
          <motion.ellipse cx="800" cy="516" rx="395" ry="88"
            stroke={c} strokeWidth="2.6" fill="none" filter="url(#sb_med)"
            animate={{ opacity: isUrgent ? [0.85, 1, 0.85] : [0.74, 1, 0.74] }}
            transition={{ duration: isUrgent ? 1.0 : 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}/>
          <ellipse cx="800" cy="516" rx="395" ry="88" stroke={c} strokeWidth="1.5" fill="none" opacity="1"/>
          <ellipse cx="800" cy="516" rx="395" ry="88" stroke="#fff" strokeWidth="0.45" fill="none" opacity="0.8"/>

          {/* Middle tier panel segment dividers — sci-fi mechanical separations */}
          <g opacity="0.32">
            <line x1="560" y1="560" x2="560" y2="595" stroke="#000" strokeWidth="1"/>
            <line x1="680" y1="560" x2="680" y2="597" stroke="#000" strokeWidth="1"/>
            <line x1="800" y1="560" x2="800" y2="600" stroke="#000" strokeWidth="1.2"/>
            <line x1="920" y1="560" x2="920" y2="597" stroke="#000" strokeWidth="1"/>
            <line x1="1040" y1="560" x2="1040" y2="595" stroke="#000" strokeWidth="1"/>
          </g>

          {/* Middle tier side wall microtech — hex + tick clusters (asymmetric) */}
          <g opacity="0.55">
            <polygon points="475,572 482,568 489,572 489,580 482,584 475,580"
              fill="none" stroke={c} strokeWidth="0.55"/>
            <polygon points="1111,572 1118,568 1125,572 1125,580 1118,584 1111,580"
              fill="none" stroke={c} strokeWidth="0.55"/>
            {/* Asymmetric extra hex on left side only (breaks perfect symmetry) */}
            <polygon points="492,580 498,577 504,580 504,586 498,589 492,586"
              fill="none" stroke={c} strokeWidth="0.4" opacity="0.7"/>
          </g>
          <g opacity="0.45">
            <rect x="520" y="572" width="0.8" height="6" fill={c}/>
            <rect x="525" y="574" width="0.8" height="4" fill={c}/>
            <rect x="530" y="572" width="0.8" height="6" fill={c}/>
            {/* Asymmetric: 4 ticks on right vs 3 on left */}
            <rect x="1066" y="572" width="0.8" height="6" fill={c}/>
            <rect x="1071" y="574" width="0.8" height="4" fill={c}/>
            <rect x="1076" y="572" width="0.8" height="6" fill={c}/>
            <rect x="1081" y="574" width="0.8" height="5" fill={c} opacity="0.7"/>
          </g>

          {/* Middle face accent dots */}
          <motion.circle cx="630" cy="520" r="2.5" fill={c} filter="url(#sb_tiny)"
            animate={{ opacity: [0.45, 1, 0.45] }} transition={{ duration: 1.8, repeat: Infinity, delay: 0 }}/>
          <motion.circle cx="970" cy="520" r="2.5" fill={c} filter="url(#sb_tiny)"
            animate={{ opacity: [0.45, 1, 0.45] }} transition={{ duration: 1.8, repeat: Infinity, delay: 0.7 }}/>

          {/* Middle tier sweep */}
          <g clipPath="url(#sb_midClip)">
            <rect x="295" y="430" width="1010" height="184" fill="url(#sb_sweep)">
              <animateTransform attributeName="transform" type="translate"
                values="-700 0;700 0;700 0;-700 0" keyTimes="0;0.42;0.5;1"
                dur="6s" begin="1.5s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.08;0.38;0.44;1"
                dur="6s" begin="1.5s" repeatCount="indefinite"/>
            </rect>
          </g>

          {/* ═══════════════════════════════════ */}
          {/* 5. TOP TIER                        */}
          {/* ═══════════════════════════════════ */}

          {/* Side wall */}
          <path d="M 560 423
                   C 560 480 1040 480 1040 423
                   L 1040 452
                   C 1040 495 560 495 560 452 Z"
            fill="url(#sb_side_wall)"/>

          {/* Mid horizontal reflection band */}
          <path d="M 565 437 C 565 472 1035 472 1035 437"
            stroke={c} strokeWidth="0.7" fill="none" opacity="0.3" filter="url(#sb_tiny)"/>

          {/* Cyan bottom edge */}
          <path d="M 568 454 C 568 488 1032 488 1032 454"
            stroke={c} strokeWidth="1.8" fill="none" opacity="0.75" filter="url(#sb_med)"/>
          <path d="M 588 462 C 588 484 1012 484 1012 462"
            stroke={c} strokeWidth="0.9" fill="none" opacity="0.6"/>

          {/* Ambient occlusion — sharp seam + soft spread */}
          <ellipse cx="800" cy="478" rx="225" ry="10" fill="#000" opacity="0.6" filter="url(#sb_med)"/>
          <ellipse cx="800" cy="468" rx="220" ry="3.5" fill="#000" opacity="0.72"/>

          {/* Top face */}
          <ellipse cx="800" cy="423" rx="240" ry="62" fill="url(#sb_top_face)"/>
          {/* Glossy reflection */}
          <ellipse cx="800" cy="423" rx="240" ry="62" fill="url(#sb_glossy)"/>

          {/* Top tier — outer trim ring (dual-structure / teleporter device feel) */}
          <ellipse cx="800" cy="424" rx="251" ry="66" stroke={c} strokeWidth="0.6" fill="none" opacity="0.45"/>
          <ellipse cx="800" cy="424" rx="251" ry="66" stroke={c} strokeWidth="0.3" fill="none" opacity="0.7" filter="url(#sb_tiny)"/>

          {/* Top neon rim — main ring */}
          <motion.ellipse cx="800" cy="424" rx="240" ry="62"
            stroke={c} strokeWidth="6.5" fill="none" filter="url(#sb_big)"
            animate={{ opacity: isUrgent ? [0.7, 0.95, 0.7] : [0.5, 0.78, 0.5] }}
            transition={{ duration: isUrgent ? 1.0 : 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}/>
          <motion.ellipse cx="800" cy="424" rx="240" ry="62"
            stroke={c} strokeWidth="2.3" fill="none" filter="url(#sb_med)"
            animate={{ opacity: isUrgent ? [0.88, 1, 0.88] : [0.78, 1, 0.78] }}
            transition={{ duration: isUrgent ? 1.0 : 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}/>
          <ellipse cx="800" cy="424" rx="240" ry="62" stroke={c} strokeWidth="1.4" fill="none" opacity="1"/>
          <ellipse cx="800" cy="424" rx="240" ry="62" stroke="#fff" strokeWidth="0.4" fill="none" opacity="0.85"/>

          {/* LED segment indicators around the top ring (cardinal + diagonals, upper half) */}
          <motion.circle cx="800" cy="362" r="2.4" fill={c} filter="url(#sb_med)"
            animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.0, repeat: Infinity, delay: 0 }}/>
          <motion.circle cx="970" cy="378" r="2" fill={c} filter="url(#sb_tiny)"
            animate={{ opacity: [0.45, 0.92, 0.45] }} transition={{ duration: 2.3, repeat: Infinity, delay: 0.4 }}/>
          <motion.circle cx="630" cy="378" r="2" fill={c} filter="url(#sb_tiny)"
            animate={{ opacity: [0.45, 0.92, 0.45] }} transition={{ duration: 2.3, repeat: Infinity, delay: 0.9 }}/>
          <motion.circle cx="1040" cy="424" r="2.2" fill={c} filter="url(#sb_tiny)"
            animate={{ opacity: [0.5, 0.95, 0.5] }} transition={{ duration: 2.1, repeat: Infinity, delay: 1.3 }}/>
          <motion.circle cx="560" cy="424" r="2.2" fill={c} filter="url(#sb_tiny)"
            animate={{ opacity: [0.5, 0.95, 0.5] }} transition={{ duration: 2.1, repeat: Infinity, delay: 0.7 }}/>

          {/* Small radial segment ticks between LEDs (suggests segmented device construction) */}
          <g opacity="0.4">
            <line x1="897" y1="368" x2="901" y2="375" stroke={c} strokeWidth="0.6"/>
            <line x1="703" y1="368" x2="699" y2="375" stroke={c} strokeWidth="0.6"/>
            <line x1="1011" y1="396" x2="1006" y2="402" stroke={c} strokeWidth="0.6"/>
            <line x1="589" y1="396" x2="594" y2="402" stroke={c} strokeWidth="0.6"/>
          </g>

          {/* ═══════════════════════════════════════════ */}
          {/* 6. HOLOGRAPHIC ELEVATOR (center platform) */}
          {/* ═══════════════════════════════════════════ */}

          {/* Outer halo glow */}
          <ellipse cx="800" cy="412" rx="195" ry="50" fill="url(#sb_core_glow)" opacity="0.75">
            <animate attributeName="opacity" values="0.55;0.95;0.55" dur="2.5s" repeatCount="indefinite"/>
          </ellipse>

          {/* Inner dark pad — DEEP WELL gradient (reactor depression) */}
          <ellipse cx="800" cy="410" rx="160" ry="40" fill="url(#sb_well)"/>
          {/* Faint cyan mist inside the well */}
          <ellipse cx="800" cy="410" rx="100" ry="22" fill={c} opacity="0.05" filter="url(#sb_big)"/>

          {/* Pad ring — bright cyan triple layer */}
          <motion.ellipse cx="800" cy="410" rx="160" ry="40"
            stroke={c} strokeWidth="6" fill="none" filter="url(#sb_med)"
            animate={{ opacity: isUrgent ? [0.7, 1, 0.7] : [0.5, 0.85, 0.5] }}
            transition={{ duration: isUrgent ? 1.0 : 2.5, repeat: Infinity, ease: 'easeInOut' }}/>
          <motion.ellipse cx="800" cy="410" rx="160" ry="40"
            stroke={c} strokeWidth="2.2" fill="none" filter="url(#sb_tiny)"
            animate={{ opacity: isUrgent ? [0.85, 1, 0.85] : [0.72, 1, 0.72] }}
            transition={{ duration: isUrgent ? 1.0 : 2.5, repeat: Infinity, ease: 'easeInOut' }}/>
          <ellipse cx="800" cy="410" rx="160" ry="40" stroke={c} strokeWidth="1" fill="none" opacity="1"/>
          <ellipse cx="800" cy="410" rx="160" ry="40" stroke="#fff" strokeWidth="0.5" fill="none" opacity="0.7"/>

          {/* Inner secondary ring — gives elevator a multi-layer "device" feel */}
          <ellipse cx="800" cy="410" rx="128" ry="30" stroke={c} strokeWidth="1.2" fill="none"
            opacity="0.6" filter="url(#sb_tiny)"/>
          <ellipse cx="800" cy="410" rx="128" ry="30" stroke="#fff" strokeWidth="0.35" fill="none" opacity="0.35"/>

          {/* Reactor interior — concentric depth rings (sub-128) */}
          <ellipse cx="800" cy="410" rx="100" ry="22" stroke={c} strokeWidth="0.55" fill="none" opacity="0.5"/>
          <ellipse cx="800" cy="410" rx="72" ry="16" stroke={c} strokeWidth="0.45" fill="none" opacity="0.42"/>
          <ellipse cx="800" cy="410" rx="44" ry="9" stroke={c} strokeWidth="0.35" fill="none" opacity="0.35"/>

          {/* Inner tick marks — 8 compass positions around the inner secondary ring */}
          <g opacity="0.55">
            <rect x="799.4" y="377" width="1.2" height="4" fill={c}/>
            <rect x="799.4" y="439" width="1.2" height="4" fill={c}/>
            <rect x="924" y="409.4" width="4" height="1.2" fill={c}/>
            <rect x="672" y="409.4" width="4" height="1.2" fill={c}/>
            <line x1="888" y1="385" x2="891" y2="388" stroke={c} strokeWidth="1"/>
            <line x1="712" y1="385" x2="709" y2="388" stroke={c} strokeWidth="1"/>
            <line x1="888" y1="435" x2="891" y2="432" stroke={c} strokeWidth="1"/>
            <line x1="712" y1="435" x2="709" y2="432" stroke={c} strokeWidth="1"/>
          </g>

          {/* Small HUD micro indicators inside the well — asymmetric for depth */}
          <g opacity="0.5">
            <rect x="745" y="395" width="6" height="1" fill={c}/>
            <rect x="745" y="397.5" width="9" height="0.8" fill={c} opacity="0.65"/>
            <rect x="849" y="423" width="6" height="1" fill={c}/>
            <rect x="844" y="425.5" width="11" height="0.8" fill={c} opacity="0.65"/>
            <circle cx="752" cy="424" r="1.5" fill="none" stroke={c} strokeWidth="0.4"/>
            <circle cx="848" cy="396" r="1.5" fill="none" stroke={c} strokeWidth="0.4"/>
          </g>

          {/* Reactor core — bright pulsing center (the heart of the elevator) */}
          <motion.ellipse cx="800" cy="410" rx="22" ry="5.5" fill={c} filter="url(#sb_med)"
            animate={{ opacity: [0.5, 0.92, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}/>
          <motion.ellipse cx="800" cy="410" rx="14" ry="3.2" fill={c} filter="url(#sb_tiny)"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}/>
          <motion.circle cx="800" cy="410" r="1.8" fill="#fff"
            animate={{ opacity: [0.75, 1, 0.75] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}/>

          {/* Scanning dashed ring — dashes appear to march around perimeter */}
          <ellipse cx="800" cy="408" rx="172" ry="44" stroke={c} strokeWidth="1.3" fill="none"
            strokeDasharray="14 22" opacity="0.7">
            <animate attributeName="stroke-dashoffset" values="0;-108" dur="3s" repeatCount="indefinite"/>
          </ellipse>

          {/* Expanding holographic pulse rings — radiate outward periodically */}
          <ellipse cx="800" cy="410" stroke={c} strokeWidth="1.4" fill="none">
            <animate attributeName="rx" values="160;220;220" dur="3.6s" repeatCount="indefinite" begin="0s"/>
            <animate attributeName="ry" values="40;60;60" dur="3.6s" repeatCount="indefinite" begin="0s"/>
            <animate attributeName="opacity" values="0.7;0.1;0" keyTimes="0;0.8;1" dur="3.6s" repeatCount="indefinite" begin="0s"/>
          </ellipse>
          <ellipse cx="800" cy="410" stroke={c} strokeWidth="1.4" fill="none">
            <animate attributeName="rx" values="160;220;220" dur="3.6s" repeatCount="indefinite" begin="1.8s"/>
            <animate attributeName="ry" values="40;60;60" dur="3.6s" repeatCount="indefinite" begin="1.8s"/>
            <animate attributeName="opacity" values="0.7;0.1;0" keyTimes="0;0.8;1" dur="3.6s" repeatCount="indefinite" begin="1.8s"/>
          </ellipse>

          {/* Light beams rising from pad perimeter */}
          <rect x="649" y="378" width="3" height="38" fill="url(#sb_beam)" opacity="0.6">
            <animate attributeName="opacity" values="0.3;0.85;0.3" dur="2s" repeatCount="indefinite" begin="0s"/>
          </rect>
          <rect x="948" y="378" width="3" height="38" fill="url(#sb_beam)" opacity="0.6">
            <animate attributeName="opacity" values="0.3;0.85;0.3" dur="2s" repeatCount="indefinite" begin="0.5s"/>
          </rect>
          <rect x="720" y="380" width="2" height="26" fill="url(#sb_beam)" opacity="0.4">
            <animate attributeName="opacity" values="0.2;0.6;0.2" dur="2.5s" repeatCount="indefinite" begin="0.8s"/>
          </rect>
          <rect x="878" y="380" width="2" height="26" fill="url(#sb_beam)" opacity="0.4">
            <animate attributeName="opacity" values="0.2;0.6;0.2" dur="2.5s" repeatCount="indefinite" begin="1.3s"/>
          </rect>

          {/* Top tier sweep */}
          <g clipPath="url(#sb_topClip)">
            <rect x="448" y="369" width="704" height="114" fill="url(#sb_sweep)">
              <animateTransform attributeName="transform" type="translate"
                values="-400 0;400 0;400 0;-400 0" keyTimes="0;0.42;0.5;1"
                dur="4s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.08;0.38;0.44;1"
                dur="4s" repeatCount="indefinite"/>
            </rect>
          </g>

          {/* ═══════════════════════════════════ */}
          {/* 7. ENERGY CORE — rising particles  */}
          {/* ═══════════════════════════════════ */}

          <circle cx="720" cy="410" r="2.2" fill={c} filter="url(#sb_soft)" opacity="0">
            <animate attributeName="cy" values="410;380;410" dur="3s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0;0.85;0" keyTimes="0;0.5;1" dur="3s" repeatCount="indefinite"/>
          </circle>
          <circle cx="880" cy="412" r="1.8" fill={c} filter="url(#sb_soft)" opacity="0">
            <animate attributeName="cy" values="412;380;412" dur="3.5s" begin="0.5s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0;0.8;0" keyTimes="0;0.5;1" dur="3.5s" begin="0.5s" repeatCount="indefinite"/>
          </circle>
          <circle cx="800" cy="415" r="2.4" fill={c} filter="url(#sb_soft)" opacity="0">
            <animate attributeName="cy" values="415;378;415" dur="3.2s" begin="1.2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0;0.9;0" keyTimes="0;0.5;1" dur="3.2s" begin="1.2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="755" cy="408" r="1.5" fill={c} filter="url(#sb_soft)" opacity="0">
            <animate attributeName="cy" values="408;378;408" dur="2.8s" begin="1.7s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0;0.75;0" keyTimes="0;0.5;1" dur="2.8s" begin="1.7s" repeatCount="indefinite"/>
          </circle>
          <circle cx="845" cy="408" r="1.5" fill={c} filter="url(#sb_soft)" opacity="0">
            <animate attributeName="cy" values="408;381;408" dur="3.1s" begin="2.2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0;0.75;0" keyTimes="0;0.5;1" dur="3.1s" begin="2.2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="775" cy="415" r="1.3" fill={c} filter="url(#sb_soft)" opacity="0">
            <animate attributeName="cy" values="415;385;415" dur="3.7s" begin="2.8s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0;0.7;0" keyTimes="0;0.5;1" dur="3.7s" begin="2.8s" repeatCount="indefinite"/>
          </circle>
          <circle cx="825" cy="412" r="1.3" fill={c} filter="url(#sb_soft)" opacity="0">
            <animate attributeName="cy" values="412;382;412" dur="3.4s" begin="3.4s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0;0.7;0" keyTimes="0;0.5;1" dur="3.4s" begin="3.4s" repeatCount="indefinite"/>
          </circle>

          {/* ═══════════════════════════════════ */}
          {/* 8. URGENT RED OVERLAY              */}
          {/* ═══════════════════════════════════ */}

          <motion.ellipse cx="800" cy="515" rx="545" ry="155"
            fill="url(#sb_urgent)" filter="url(#sb_big)"
            initial={{ opacity: 0 }}
            animate={{ opacity: isUrgent ? [0.45, 0.68, 0.45] : 0 }}
            transition={{
              duration: isUrgent ? 0.85 : 0.5,
              repeat: isUrgent ? Infinity : 0,
              ease: 'easeInOut',
            }}/>
        </svg>
      </motion.div>
    </div>
  );
}
