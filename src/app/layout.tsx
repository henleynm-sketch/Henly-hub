import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Henley Hub",
  description: "Run your remodeling business from one connected hub.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
