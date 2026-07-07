import type { Config } from "tailwindcss";

// Semantic tokens are RGB channels behind CSS vars (see globals.css) so the
// whole app reskins between the Studio (dark) and Paper (light) themes.
const tok = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: tok("--bg"),
        surface: tok("--surface"),
        surface2: tok("--surface-2"),
        surface3: tok("--surface-3"),
        edge: tok("--edge"),
        edge2: tok("--edge-2"),
        ink: tok("--ink"),
        muted: tok("--muted"),
        accent: tok("--accent"),
        accent2: tok("--accent-2"),
        good: "rgb(123 182 97 / <alpha-value>)",
        // back-compat aliases used by a few components
        panel: tok("--surface"),
        panel2: tok("--surface-2"),
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        // "display" now maps to the same technical grotesque (no serif in the tool)
        display: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "12px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "26px",
        "3xl": "32px",
      },
      boxShadow: {
        soft: "0 10px 34px -14px rgb(var(--shadow) / 0.5)",
        card: "0 2px 10px -4px rgb(var(--shadow) / 0.4)",
        glow: "0 14px 40px -12px rgb(var(--accent) / 0.55)",
        "glow-sm": "0 8px 22px -10px rgb(var(--accent) / 0.5)",
      },
      backgroundImage: {
        "grad-accent":
          "linear-gradient(120deg, rgb(var(--accent)), rgb(var(--accent-2)))",
        "grad-accent-soft":
          "linear-gradient(120deg, rgb(var(--accent) / 0.14), rgb(var(--accent-2) / 0.14))",
      },
      letterSpacing: {
        label: "0.2em",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
        marquee: "marquee 32s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
