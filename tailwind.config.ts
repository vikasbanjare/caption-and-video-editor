import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#08080c",
        surface: "#0f1016",
        surface2: "#15171f",
        surface3: "#1c1f29",
        edge: "#262a36",
        edge2: "#333845",
        accent: "#7c5cff",
        accent2: "#a78bfa",
        good: "#34d399",
        muted: "#8b92a1",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,92,255,0.4), 0 8px 30px -6px rgba(124,92,255,0.5)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 10px 30px -12px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "accent-grad": "linear-gradient(135deg, #7c5cff 0%, #4f8bff 100%)",
        "hero-grad":
          "radial-gradient(1200px 600px at 50% -10%, rgba(124,92,255,0.18), transparent 60%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.3s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
