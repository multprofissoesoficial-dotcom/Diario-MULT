import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/App.tsx",
  ],
  theme: {
    extend: {
      colors: {
        "mult-orange": "#FF6B00",
        "neon-blue": "#00E5FF",
        "cockpit-bg": "#0A0E17",
        "cockpit-card": "rgba(16, 24, 39, 0.7)",
        "cockpit-border": "rgba(255, 255, 255, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
