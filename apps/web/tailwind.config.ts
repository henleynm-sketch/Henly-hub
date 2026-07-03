import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg-canvas)",
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          focus: "var(--accent-focus)",
        },
        glass: {
          bg: "var(--glass-bg)",
          border: "var(--glass-border)",
          "border-hover": "var(--glass-border-hover)",
          sidebar: "var(--sidebar-bg)",
          topbar: "var(--topbar-bg)",
        },
        ink: {
          DEFAULT: "var(--text-primary)",
          soft: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        row: {
          bg: "var(--row-bg)",
          hover: "var(--row-bg-hover)",
          active: "var(--row-bg-active)",
        },
        chip: {
          bg: "var(--chip-bg)",
          text: "var(--chip-text)",
        },
        // Retain original configuration elements for backward-compatibility
        brand: {
          50: "#f5f7ff",
          100: "#e6ebff",
          500: "#3b4ee0",
          600: "#2d3ec2",
          700: "#1f2c8f",
          900: "#0f1547",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      backdropBlur: {
        glass: "var(--glass-blur)",
      },
      boxShadow: {
        glass: "var(--glass-shadow)",
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)",
      },
      transitionTimingFunction: {
        glass: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      borderRadius: {
        lg: "16px",
        md: "10px",
        sm: "6px",
      },
    },
  },
  plugins: [],
};
export default config;
