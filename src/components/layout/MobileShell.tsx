import type { ReactNode } from "react";

interface MobileShellProps {
  children: ReactNode;
  className?: string;
}

export function MobileShell({ children, className = "" }: MobileShellProps) {
  return (
    <div className={`flex min-h-screen flex-col bg-white ${className}`}>
      {children}
    </div>
  );
}
