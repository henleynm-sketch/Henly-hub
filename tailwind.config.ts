import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0A0A0B",
        accent: {
          DEFAULT: "#5C7CFA",
          hover: "#4C6EF5",
          focus: "rgba(92, 124, 250, 0.4)",
        },
        glass: {
          bg: "rgba(20, 20, 25, 0.65)",
          border: "rgba(255, 255, 255, 0.08)",
          "border-hover": "rgba(255, 255, 255, 0.12)",
          sidebar: "rgba(15, 15, 18, 0.75)",
          topbar: "rgba(10, 10, 11, 0.65)",
        },
        ink: {
          DEFAULT: "#FFFFFF",
          soft: "#94A3B8",
          muted: "#64748B",
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
        glass: "16px",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.45)",
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
