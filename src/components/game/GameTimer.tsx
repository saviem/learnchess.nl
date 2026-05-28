interface GameTimerProps {
  secondsLeft: number;
  running: boolean;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function GameTimer({ secondsLeft, running }: GameTimerProps) {
  return (
    <div
      className={`rounded-xl border px-4 py-2 font-mono text-lg font-semibold tabular-nums ${
        running ? "border-slate-200 bg-white text-navy" : "border-slate-100 bg-slate-50 text-muted"
      } ${secondsLeft <= 60 ? "border-red-200 bg-red-50 text-red-700" : ""}`}
    >
      {formatTime(secondsLeft)}
    </div>
  );
}
