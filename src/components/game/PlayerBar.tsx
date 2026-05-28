"use client";

import { User } from "lucide-react";
import { GameTimer } from "@/components/game/GameTimer";

interface PlayerBarProps {
  elo: number;
  secondsLeft: number;
  running: boolean;
}

export function PlayerBar({ elo, secondsLeft, running }: PlayerBarProps) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200">
          <User className="h-5 w-5 text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-navy">JIJ (WIT)</p>
          <p className="text-xs text-muted">{elo} ELO</p>
        </div>
      </div>
      <GameTimer secondsLeft={secondsLeft} running={running} />
    </div>
  );
}
