import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          900: "#050816",
          800: "#080811",
          700: "#0D1117",
          600: "#111827",
        },
        neon: {
          purple: "#00E5FF",
          lavender: "#1F8CFF",
          cyan: "#00CFFF",
          green: "#00FFA3",
          gold: "#FFD166",
          red: "#FF4444",
          ice: "#EAF3FF",
        },
      },
      fontFamily: {
        display: ["'Rajdhani'", "sans-serif"],
        mono: ["'Share Tech Mono'", "monospace"],
        body: ["'Inter'", "sans-serif"],
      },
      animation: {
        "pulse-neon": "pulseNeon 2s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "glitch": "glitch 0.3s ease-in-out",
        "spin-slow": "spin 8s linear infinite",
        "scan": "scan 3s linear infinite",
        "flicker": "flicker 0.15s infinite",
        "number-roll": "numberRoll 0.1s ease-in-out",
        "reveal": "reveal 1.5s cubic-bezier(0.23, 1, 0.32, 1) forwards",
        "explode": "explode 0.8s ease-out forwards",
        "camera-zoom": "cameraZoom 3s ease-in-out forwards",
        "shake": "shake 0.5s ease-in-out",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "slide-up": "slideUp 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards",
        "slide-in-right": "slideInRight 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards",
        "matrix-fall": "matrixFall 3s linear infinite",
        "border-rotate": "borderRotate 4s linear infinite",
        "hologram": "hologram 3s ease-in-out infinite",
      },
      keyframes: {
        pulseNeon: {
          "0%, 100%": { opacity: "1", filter: "brightness(1)" },
          "50%": { opacity: "0.7", filter: "brightness(1.5)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        glitch: {
          "0%": { transform: "translate(0)" },
          "20%": { transform: "translate(-3px, 3px)" },
          "40%": { transform: "translate(3px, -3px)" },
          "60%": { transform: "translate(-3px, -3px)" },
          "80%": { transform: "translate(3px, 3px)" },
          "100%": { transform: "translate(0)" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
        numberRoll: {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        reveal: {
          "0%": { transform: "scale(0.5)", opacity: "0", filter: "blur(20px)" },
          "60%": { transform: "scale(1.1)", opacity: "1", filter: "blur(0px)" },
          "100%": { transform: "scale(1)", opacity: "1", filter: "blur(0px)" },
        },
        explode: {
          "0%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.5)", opacity: "0.5" },
          "100%": { transform: "scale(2)", opacity: "0" },
        },
        cameraZoom: {
          "0%": { transform: "scale(1)" },
          "100%": { transform: "scale(1.15)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "10%": { transform: "translateX(-10px)" },
          "30%": { transform: "translateX(10px)" },
          "50%": { transform: "translateX(-10px)" },
          "70%": { transform: "translateX(10px)" },
          "90%": { transform: "translateX(-5px)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px #9147FF, 0 0 40px #9147FF, 0 0 80px #9147FF" },
          "50%": { boxShadow: "0 0 10px #9147FF, 0 0 20px #9147FF, 0 0 40px #9147FF" },
        },
        slideUp: {
          "0%": { transform: "translateY(60px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        matrixFall: {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateY(100vh)", opacity: "0" },
        },
        borderRotate: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        hologram: {
          "0%, 100%": { opacity: "1", transform: "scaleY(1)" },
          "25%": { opacity: "0.8", transform: "scaleY(0.98)" },
          "75%": { opacity: "0.9", transform: "scaleY(1.01)" },
        },
      },
      backgroundImage: {
        "neon-grid": "linear-gradient(rgba(0, 229, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 255, 0.1) 1px, transparent 1px)",
        "cyber-gradient": "linear-gradient(135deg, #050816 0%, #0D1117 50%, #080811 100%)",
        "purple-glow": "radial-gradient(ellipse at center, rgba(0, 229, 255, 0.3) 0%, transparent 70%)",
        "cyan-glow": "radial-gradient(ellipse at center, rgba(0, 207, 255, 0.2) 0%, transparent 70%)",
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "neon-purple": "0 0 20px rgba(0, 229, 255, 0.5), 0 0 60px rgba(0, 229, 255, 0.2)",
        "neon-cyan": "0 0 20px rgba(0, 207, 255, 0.5), 0 0 60px rgba(0, 207, 255, 0.2)",
        "neon-green": "0 0 20px rgba(0, 255, 163, 0.5), 0 0 60px rgba(0, 255, 163, 0.2)",
        "neon-gold": "0 0 20px rgba(255, 209, 102, 0.5), 0 0 60px rgba(255, 209, 102, 0.2)",
        "glass": "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
        "glass-lg": "0 16px 64px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
