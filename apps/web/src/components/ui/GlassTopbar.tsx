import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassTopbarProps {
  children: ReactNode;
  className?: string;
}

export function GlassTopbar({ children, className }: GlassTopbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex h-14 items-center justify-between glass-base px-6 transition-all duration-300 text-ink",
        className
      )}
    >
      {children}
    </header>
  );
}
