import { Chess, type PieceSymbol } from "chess.js";

const PIECE_ORDER: PieceSymbol[] = ["q", "r", "b", "n", "p"];

const WHITE_PIECES: Record<PieceSymbol, string> = {
  p: "♙",
  n: "♘",
  b: "♗",
  r: "♖",
  q: "♕",
  k: "♔",
};

const BLACK_PIECES: Record<PieceSymbol, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
};

export interface CapturedPieces {
  byWhite: PieceSymbol[];
  byBlack: PieceSymbol[];
}

export function getCapturedPieces(chess: Chess): CapturedPieces {
  const byWhite: PieceSymbol[] = [];
  const byBlack: PieceSymbol[] = [];

  for (const move of chess.history({ verbose: true })) {
    if (!move.captured) {
      continue;
    }

    if (move.color === "w") {
      byWhite.push(move.captured);
    } else {
      byBlack.push(move.captured);
    }
  }

  return {
    byWhite: sortPieces(byWhite),
    byBlack: sortPieces(byBlack),
  };
}

function sortPieces(pieces: PieceSymbol[]): PieceSymbol[] {
  return [...pieces].sort(
    (a, b) => PIECE_ORDER.indexOf(a) - PIECE_ORDER.indexOf(b),
  );
}

export function pieceSymbol(piece: PieceSymbol, color: "w" | "b"): string {
  return color === "w" ? WHITE_PIECES[piece] : BLACK_PIECES[piece];
}

export function uciToSan(fen: string, uci: string): string | null {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const move = chess.move({
      from,
      to,
      promotion: promotion as "q" | "r" | "b" | "n" | undefined,
    });
    if (!move) {
      return null;
    }
    return move.san;
  } catch {
    return uci.toUpperCase();
  }
}
