"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export default function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        className="grid h-11 w-11 place-items-center rounded-lg text-ink-soft hover:text-ink hover:bg-row-hover transition-colors"
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <div
            className="absolute inset-0 bg-black/55"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto shadow-2xl">
            {children}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="absolute top-3 left-[calc(min(18rem,85vw)+12px)] grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
