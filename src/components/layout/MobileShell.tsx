import type { ReactNode } from "react";

interface MobileShellProps {
  children: ReactNode;
  className?: string;
}

export function MobileShell({ children, className = "" }: MobileShellProps) {
  return (
    <div className="dot-grid min-h-screen px-4 py-6 sm:px-6">
      <div
        className={`mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-black/30 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
