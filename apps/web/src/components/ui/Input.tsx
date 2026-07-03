import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white transition-all duration-200 placeholder:text-slate-500 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/80 focus:bg-white/10",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
