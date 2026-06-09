import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassSidebarProps {
  children: ReactNode;
  className?: string;
}

export function GlassSidebar({ children, className }: GlassSidebarProps) {
  return (
    <aside
      className={cn(
        "hidden md:flex md:w-64 md:flex-col md:border-r md:border-glass-border md:bg-glass-sidebar/85 md:backdrop-blur-glass shadow-lg transition-all duration-300",
        className
      )}
    >
      {children}
    </aside>
  );
}
