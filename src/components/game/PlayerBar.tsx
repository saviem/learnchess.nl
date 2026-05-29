"use client";

import { Bot, User } from "lucide-react";
import { ChessPieceIcon } from "@/components/game/chess-pieces";
import type { PieceSymbol } from "chess.js";

interface PlayerBarProps {
  name: string;
  rating?: number;
  captured: PieceSymbol[];
  capturedPieceColor: "w" | "b";
  materialPlus?: number | null;
  variant: "user" | "opponent";
}

export function PlayerBar({
  name,
  rating,
  captured,
  capturedPieceColor,
  materialPlus,
  variant,
}: PlayerBarProps) {
  const Icon = variant === "user" ? User : Bot;

  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[#eeeed2]">
        <Icon
          className={`h-5 w-5 ${variant === "user" ? "text-[#262421]" : "text-[#4a4a4a]"}`}
          strokeWidth={1.75}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-tight text-navy">
          {name}
          {rating != null && (
            <span className="font-normal text-muted"> ({rating})</span>
          )}
        </p>
        <div className="mt-1 flex min-h-[18px] flex-wrap items-center gap-px">
          {captured.map((piece, index) => (
            <ChessPieceIcon
              key={`${piece}-${index}`}
              piece={piece}
              color={capturedPieceColor}
              size={17}
            />
          ))}
          {materialPlus != null && materialPlus > 0 && (
            <span className="ml-1 text-[13px] font-semibold text-muted">
              +{materialPlus}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
