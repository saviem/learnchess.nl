export type MoveClassification =
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export function evalFromWhitePerspective(fen: string, centipawns: number): number {
  return fen.split(" ")[1] === "w" ? centipawns : -centipawns;
}

export function normalizeUci(uci: string): string {
  return uci.trim().toLowerCase();
}

export function isSameUciMove(a: string, b: string): boolean {
  return normalizeUci(a) === normalizeUci(b);
}

export function classifyMove(
  centipawnLoss: number,
  playedMove: string,
  bestMove: string,
): MoveClassification {
  if (isSameUciMove(playedMove, bestMove) || centipawnLoss <= 10) {
    return "excellent";
  }
  if (centipawnLoss <= 25) {
    return "good";
  }
  if (centipawnLoss <= 60) {
    return "inaccuracy";
  }
  if (centipawnLoss <= 150) {
    return "mistake";
  }
  return "blunder";
}

export function parseScore(scoreLine: string): number {
  const mateMatch = scoreLine.match(/score mate (-?\d+)/);
  if (mateMatch) {
    const mateIn = Number(mateMatch[1]);
    return mateIn > 0 ? 10000 - mateIn : -10000 - mateIn;
  }

  const cpMatch = scoreLine.match(/score cp (-?\d+)/);
  if (cpMatch) {
    return Number(cpMatch[1]);
  }

  return 0;
}

export function formatEval(centipawns: number): string {
  if (Math.abs(centipawns) >= 9000) {
    return centipawns > 0 ? "Mat" : "-Mat";
  }
  return `${centipawns >= 0 ? "+" : ""}${(centipawns / 100).toFixed(1)}`;
}

export function classificationLabel(classification: MoveClassification): string {
  switch (classification) {
    case "excellent":
      return "Uitstekende zet";
    case "good":
      return "Goede zet";
    case "inaccuracy":
      return "Onnauwkeurigheid";
    case "mistake":
      return "Fout";
    case "blunder":
      return "Blunder";
  }
}
