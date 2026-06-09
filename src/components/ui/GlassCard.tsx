import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}

export function GlassCard({ children, className, hoverable = true }: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-glass-bg border border-glass-border shadow-glass backdrop-blur-glass transition-all duration-300 ease-glass",
        hoverable && "hover:border-glass-border-hover hover:bg-[rgba(25,25,32,0.7)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.55)]",
        className
      )}
    >
      {children}
    </div>
  );
}
