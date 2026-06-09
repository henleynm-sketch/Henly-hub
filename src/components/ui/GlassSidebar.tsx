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
        "hidden md:flex md:w-64 md:flex-col glass-sidebar transition-all duration-300 text-ink",
        className
      )}
    >
      {children}
    </aside>
  );
}
