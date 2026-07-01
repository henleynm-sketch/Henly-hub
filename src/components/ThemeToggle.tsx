"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggleTheme() {
    const nextIsLight = !isLight;
    setIsLight(nextIsLight);
    
    if (nextIsLight) {
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
    }
  }

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-lg border border-white/5 bg-white/3 shrink-0" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="hh-tile-btn relative flex h-9 w-9 items-center justify-center rounded-xl active:scale-90"
      aria-label="Toggle light/dark theme"
    >
      <div className="relative h-4 w-4 transition-transform duration-500 ease-glass" style={{ transform: isLight ? 'rotate(180deg)' : 'rotate(0deg)' }}>
        {isLight ? (
          <Sun className="h-4 w-4 text-amber-500 shrink-0" />
        ) : (
          <Moon className="h-4 w-4 text-indigo-400 shrink-0" />
        )}
      </div>
    </button>
  );
}
