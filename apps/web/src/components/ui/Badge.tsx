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
        "hh-badge",
        variant === "green" && "hh-badge--success",
        variant === "amber" && "hh-badge--warning",
        variant === "red" && "hh-badge--danger",
        className
      )}
    >
      {children}
    </span>
  );
}
