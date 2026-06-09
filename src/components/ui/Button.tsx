import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50",
          variant === "primary" && "bg-accent text-white hover:bg-accent-hover shadow-[0_4px_14px_rgba(92,124,250,0.35)] hover:shadow-[0_6px_20px_rgba(92,124,250,0.5)]",
          variant === "secondary" && "bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/15",
          variant === "ghost" && "text-slate-400 hover:bg-white/5 hover:text-white",
          variant === "destructive" && "bg-destructive/20 border border-destructive/25 text-red-300 hover:bg-destructive/25 hover:border-destructive/40 hover:text-white",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
