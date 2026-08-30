import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fonds
        background: "#0F1117",
        surface: "#1A1D27",
        "surface-raised": "#232637",
        border: "#2D3148",

        // Textes
        "text-primary": "#E2E8F0",
        "text-secondary": "#8892A4",
        "text-disabled": "#4A5568",

        // Sémantiques
        primary: {
          DEFAULT: "#3B82F6",
          hover: "#2563EB",
        },
        success: {
          DEFAULT: "#10B981",
          hover: "#059669",
        },
        warning: {
          DEFAULT: "#F59E0B",
          hover: "#D97706",
        },
        danger: {
          DEFAULT: "#EF4444",
          hover: "#DC2626",
        },
        neutral: {
          DEFAULT: "#8892A4",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        title: ["24px", { fontWeight: "700" }],
        subtitle: ["18px", { fontWeight: "600" }],
        body: ["14px", { fontWeight: "400" }],
        caption: ["12px", { fontWeight: "400" }],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
      },
    },
  },
  plugins: [],
};

export default config;
