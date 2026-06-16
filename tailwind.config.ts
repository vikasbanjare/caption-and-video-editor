import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0d12",
        panel: "#13161d",
        panel2: "#1b1f29",
        edge: "#272c38",
        accent: "#6d8bff",
      },
    },
  },
  plugins: [],
};

export default config;
