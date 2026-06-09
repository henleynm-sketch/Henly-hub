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
        "sticky top-0 z-30 flex h-14 items-center justify-between border-b border-glass-border bg-glass-topbar/60 px-6 backdrop-blur-glass shadow-sm transition-all duration-300",
        className
      )}
    >
      {children}
    </header>
  );
}
