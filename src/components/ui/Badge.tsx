import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: ReactNode;
  variant?: "slate" | "blue" | "green" | "amber" | "red" | "violet";
  className?: string;
}

export function Badge({ children, variant = "slate", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "badge",
        variant === "slate" && "bg-white/5 text-slate-350 border-white/10",
        variant === "blue" && "bg-blue-500/10 text-blue-300 border-blue-500/20",
        variant === "green" && "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
        variant === "amber" && "bg-amber-500/10 text-amber-300 border-amber-500/20",
        variant === "red" && "bg-rose-500/10 text-rose-300 border-rose-500/20",
        variant === "violet" && "bg-violet-500/10 text-violet-300 border-violet-500/20",
        className
      )}
    >
      {children}
    </span>
  );
}
