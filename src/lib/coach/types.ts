import type { DifficultyLevel } from "@/lib/chess/difficulty";

export type MoveClassification =
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export interface MoveAnalysis {
  evalBefore: number;
  evalAfter: number;
  centipawnLoss: number;
  classification: MoveClassification;
  bestMove: string;
  playedMove: string;
  alternatives: string[];
  pv: string[];
}

export interface CoachRequest {
  fen: string;
  moveSan: string;
  level: DifficultyLevel;
  analysis: MoveAnalysis;
  isGameOver?: boolean;
  gameResult?: string;
}

export interface CoachResponse {
  summary: string;
  verdict: MoveClassification | "neutral";
  followUpSteps: string[];
  variantLine?: string;
  blunderAnalysis?: string;
  source: "openai" | "fallback";
}

export interface PositionAnalysis {
  evalScore: number;
  bestMove: string;
  alternatives: string[];
  pv: string[];
}

export interface HintSuggestion {
  move: string;
  reason: string;
}

export interface HintRequest {
  fen: string;
  level: DifficultyLevel;
  analysis: PositionAnalysis;
}

export interface HintResponse {
  summary: string;
  suggestions: HintSuggestion[];
  plan: string;
  source: "openai" | "fallback";
}
