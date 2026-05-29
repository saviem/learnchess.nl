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

const STARTING_COUNTS: Record<PieceSymbol, number> = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
  k: 1,
};

const PROMOTABLE: PieceSymbol[] = ["q", "r", "b", "n"];

export interface CapturedPieces {
  byWhite: PieceSymbol[];
  byBlack: PieceSymbol[];
}

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function materialValue(pieces: PieceSymbol[]): number {
  return pieces.reduce((sum, piece) => sum + PIECE_VALUES[piece], 0);
}

export function capturedMaterialAdvantage(
  captured: CapturedPieces,
  side: "w" | "b",
): number | null {
  const gained =
    side === "w"
      ? materialValue(captured.byWhite)
      : materialValue(captured.byBlack);
  const lost =
    side === "w"
      ? materialValue(captured.byBlack)
      : materialValue(captured.byWhite);
  const diff = gained - lost;

  return diff > 0 ? diff : null;
}

type Color = "w" | "b";

type PieceCounts = Record<PieceSymbol, number>;

function emptyCounts(): PieceCounts {
  return { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
}

function countPiecesOnBoard(chess: Chess): Record<Color, PieceCounts> {
  const counts: Record<Color, PieceCounts> = {
    w: emptyCounts(),
    b: emptyCounts(),
  };

  for (const row of chess.board()) {
    for (const square of row) {
      if (square) {
        counts[square.color][square.type]++;
      }
    }
  }

  return counts;
}

function getCapturedPiecesFromHistory(chess: Chess): CapturedPieces {
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

function countPromotions(onBoard: Record<Color, PieceCounts>, color: Color): number {
  return PROMOTABLE.reduce(
    (total, type) =>
      total + Math.max(0, onBoard[color][type] - STARTING_COUNTS[type]),
    0,
  );
}

function getCapturedPiecesFromMaterial(chess: Chess): CapturedPieces {
  const onBoard = countPiecesOnBoard(chess);
  const byWhite: PieceSymbol[] = [];
  const byBlack: PieceSymbol[] = [];

  const whitePromotions = countPromotions(onBoard, "w");
  const blackPromotions = countPromotions(onBoard, "b");

  for (const type of PIECE_ORDER) {
    const blackMissing = STARTING_COUNTS[type] - onBoard.b[type];
    const whiteMissing = STARTING_COUNTS[type] - onBoard.w[type];

    if (type === "p") {
      const blackPawnsCaptured = Math.max(0, blackMissing - blackPromotions);
      const whitePawnsCaptured = Math.max(0, whiteMissing - whitePromotions);

      for (let index = 0; index < blackPawnsCaptured; index++) {
        byWhite.push(type);
      }

      for (let index = 0; index < whitePawnsCaptured; index++) {
        byBlack.push(type);
      }

      continue;
    }

    for (let index = 0; index < Math.max(0, blackMissing); index++) {
      byWhite.push(type);
    }

    for (let index = 0; index < Math.max(0, whiteMissing); index++) {
      byBlack.push(type);
    }
  }

  return {
    byWhite: sortPieces(byWhite),
    byBlack: sortPieces(byBlack),
  };
}

export function getCapturedPieces(chess: Chess): CapturedPieces {
  if (chess.history().length > 0) {
    return getCapturedPiecesFromHistory(chess);
  }

  return getCapturedPiecesFromMaterial(chess);
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
