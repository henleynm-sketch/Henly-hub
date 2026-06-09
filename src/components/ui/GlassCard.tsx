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
        "glass-card",
        !hoverable && "hover:transform-none hover:shadow-none",
        className
      )}
    >
      {children}
    </div>
  );
}
