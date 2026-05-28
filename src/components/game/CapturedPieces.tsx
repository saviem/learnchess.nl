import type { ReactNode } from "react";
import { pieceSymbol, type CapturedPieces } from "@/lib/chess/captures";
import type { PieceSymbol } from "chess.js";

interface CapturedPiecesBarProps {
  label: string;
  pieces: PieceSymbol[];
  color: "w" | "b";
}

function PieceRow({
  label,
  pieces,
  color,
}: CapturedPiecesBarProps) {
  return (
    <div className="flex min-h-[28px] items-center gap-2 px-4 py-1.5">
      <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {pieces.length === 0 ? (
          <span className="text-xs text-slate-300">—</span>
        ) : (
          pieces.map((piece, index) => (
            <span
              key={`${piece}-${index}`}
              className={`text-lg leading-none ${
                color === "w" ? "text-slate-700" : "text-slate-900"
              }`}
              aria-hidden
            >
              {pieceSymbol(piece, color)}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

interface CapturedPiecesDisplayProps {
  captured: CapturedPieces;
}

export function CapturedPiecesDisplay({ captured }: CapturedPiecesDisplayProps) {
  return (
    <div className="border-b border-slate-100 bg-slate-50/80">
      <PieceRow
        label="Jij slaat"
        pieces={captured.byWhite}
        color="b"
      />
      <PieceRow
        label="Bot slaat"
        pieces={captured.byBlack}
        color="w"
      />
    </div>
  );
}

interface GameControlsProps {
  onUndo: () => void;
  onNext: () => void;
  canUndo: boolean;
  canNext: boolean;
  nextLoading?: boolean;
}

export function GameControls({
  onUndo,
  onNext,
  canUndo,
  canNext,
  nextLoading,
}: GameControlsProps) {
  return (
    <div className="flex gap-2 px-4 py-2">
      <ControlButton onClick={onUndo} disabled={!canUndo}>
        ↩ Zet terug
      </ControlButton>
      <ControlButton onClick={onNext} disabled={!canNext || nextLoading}>
        {nextLoading ? "Even geduld..." : "Volgende →"}
      </ControlButton>
    </div>
  );
}

function ControlButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-navy transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
