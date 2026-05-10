import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0f172a", soft: "#1e293b" },
        brand: {
          50: "#f5f7ff",
          100: "#e6ebff",
          500: "#3b4ee0",
          600: "#2d3ec2",
          700: "#1f2c8f",
          900: "#0f1547",
        },
        accent: { 500: "#d97706", 600: "#b45309" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
