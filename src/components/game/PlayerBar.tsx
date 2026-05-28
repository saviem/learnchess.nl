"use client";

import { User } from "lucide-react";

interface PlayerBarProps {
  elo: number;
}

export function PlayerBar({ elo }: PlayerBarProps) {
  return (
    <div className="flex items-center border-b border-slate-100 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200">
          <User className="h-5 w-5 text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-navy">JIJ (WIT)</p>
          <p className="text-xs text-muted">{elo} ELO</p>
        </div>
      </div>
    </div>
  );
}
