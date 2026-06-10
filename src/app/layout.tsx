import "./globals.css";
import type { Metadata, Viewport } from "next";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "Henley Hub",
  description: "Run your remodeling business from one connected hub.",
  manifest: "/manifest.webmanifest",
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Henley Hub" },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme') || 'dark';
                  if (theme === 'light') {
                    document.documentElement.classList.add('light');
                  } else {
                    document.documentElement.classList.remove('light');
                  }
                } catch (e) {}
              })()
            `,
          }}
        />
      </head>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
