"use client";

import type { PieceRenderObject } from "react-chessboard";
import type { PieceSymbol } from "chess.js";

const PIECE_SET = "cburnett";

const PIECE_KEYS = [
  "wP",
  "wN",
  "wB",
  "wR",
  "wQ",
  "wK",
  "bP",
  "bN",
  "bB",
  "bR",
  "bQ",
  "bK",
] as const;

type PieceKey = (typeof PIECE_KEYS)[number];

type PieceProps = {
  fill?: string;
  square?: string;
  svgStyle?: React.CSSProperties;
};

function cburnettPiece(key: PieceKey) {
  function CburnettPiece(props?: PieceProps) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/pieces/${PIECE_SET}/${key}.svg`}
        alt=""
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          ...props?.svgStyle,
        }}
      />
    );
  }

  CburnettPiece.displayName = `CburnettPiece(${key})`;
  return CburnettPiece;
}

export const fancyPieces = Object.fromEntries(
  PIECE_KEYS.map((key) => [key, cburnettPiece(key)]),
) as PieceRenderObject;

export function pieceKey(color: "w" | "b", piece: PieceSymbol): PieceKey {
  return `${color}${piece.toUpperCase()}` as PieceKey;
}

interface ChessPieceIconProps {
  piece: PieceSymbol;
  color: "w" | "b";
  size?: number;
}

export function ChessPieceIcon({
  piece,
  color,
  size = 18,
}: ChessPieceIconProps) {
  const key = pieceKey(color, piece);

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/pieces/${PIECE_SET}/${key}.svg`}
        alt=""
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </span>
  );
}
