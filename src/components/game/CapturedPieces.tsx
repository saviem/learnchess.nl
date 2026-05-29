import type { ReactNode } from "react";

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
    <div className="flex gap-2 px-3 py-2.5">
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
      className="flex-1 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-navy transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
