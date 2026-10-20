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
        industrial: {
          950: "#070a11",
          900: "#0b0f19",
          850: "#0f1523",
          800: "#141c2e",
          700: "#1e2a44",
          600: "#2a3b5c",
          500: "#475569",
        },
        tech: {
          cyan: "#06b6d4",
          blue: "#3b82f6",
          amber: "#f59e0b",
          red: "#ef4444",
          green: "#10b981",
        }
      },
      fontFamily: {
        mono: ["GeistMono", "Courier New", "monospace"],
      }
    },
  },
  plugins: [],
};
export default config;
