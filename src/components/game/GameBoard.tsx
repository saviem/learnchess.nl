"use client";

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { Chessboard } from "react-chessboard";
import { fancyPieces } from "@/components/game/chess-pieces";
import { Chess, DEFAULT_POSITION, type Square } from "chess.js";
import { PlayerBar } from "@/components/game/PlayerBar";
import { CoachBubble } from "@/components/game/CoachBubble";
import { GameControls } from "@/components/game/CapturedPieces";
import {
  getDifficultyConfig,
  type DifficultyLevel,
} from "@/lib/chess/difficulty";
import {
  capturedMaterialAdvantage,
  getCapturedPieces,
  uciToSan,
} from "@/lib/chess/captures";
import {
  GAME_INTRO_TEXT,
  SESSION_STORAGE_PREFIX,
  SUGGEST_PHASE_PROMPT,
} from "@/lib/constants";
import type { CoachResponse } from "@/lib/coach/types";
import type { MoveAnalysis, PositionAnalysis } from "@/lib/coach/types";
import {
  dedupeHintSuggestions,
  formatHintFollowUpSteps,
} from "@/lib/coach/prompt";
import { buildOpponentMoveSummary, playedMoveMatchesSuggestion } from "@/lib/chess/move-language";

type GamePhase = "suggest" | "review" | "bot";

interface PendingMove {
  fenBefore: string;
  moveSan: string;
  playedMoveUci: string;
  isOver: boolean;
  result: string | null;
}

interface SavedGameState {
  fen: string;
  gameOver: boolean;
  gameResult: string | null;
  phase?: GamePhase | "opponent";
  pendingMove?: PendingMove | null;
}

interface GameBoardProps {
  level: DifficultyLevel;
}

function storageKey(level: DifficultyLevel) {
  return `${SESSION_STORAGE_PREFIX}-${level}`;
}

function getGameResult(chess: Chess): string {
  if (chess.isCheckmate()) {
    return chess.turn() === "w"
      ? "Je bent schaakmat — de bot wint."
      : "Schaakmat! Je wint de partij!";
  }
  if (chess.isStalemate()) return "Pat — remise.";
  if (chess.isDraw()) return "Remise.";
  return "Partij afgelopen.";
}

function getLastMove(chess: Chess): { from: string; to: string } | null {
  const history = chess.history({ verbose: true });
  const last = history[history.length - 1];
  if (!last) {
    return null;
  }
  return { from: last.from, to: last.to };
}

function createInitialState() {
  const chess = new Chess();
  return {
    chess,
    fen: DEFAULT_POSITION,
    gameOver: false,
    gameResult: null as string | null,
  };
}

function isOpeningPosition(chess: Chess): boolean {
  return chess.history().length === 0;
}

function buildSuggestionsFromAnalysis(
  fen: string,
  analysis: PositionAnalysis,
) {
  const bestSan = uciToSan(fen, analysis.bestMove);
  const altSans = analysis.alternatives
    .map((uci) => uciToSan(fen, uci))
    .filter(Boolean) as string[];

  return dedupeHintSuggestions(
    [bestSan, ...altSans]
      .filter((move): move is string => Boolean(move))
      .map((move) => ({ move, reason: "" })),
  ).slice(0, 3);
}

function getDefaultSuggestions(opening: boolean) {
  return opening
    ? [
        { move: "e4", reason: "" },
        { move: "Nf3", reason: "" },
      ]
    : [];
}

function pieceTypeFromSquare(chess: Chess, square: string): string {
  const piece = chess.get(square as Square);
  if (!piece) {
    return "wP";
  }

  return `${piece.color}${piece.type.toUpperCase()}`;
}

function isWhitePieceType(pieceType: string): boolean {
  return pieceType.startsWith("w");
}

function mergeBotAnalysisWithSuggestions(
  opponent: CoachResponse,
  fen: string,
  suggestions: { move: string; reason: string }[],
): CoachResponse {
  return {
    summary: opponent.summary,
    verdict: opponent.verdict ?? "neutral",
    followUpSteps: formatHintFollowUpSteps(fen, suggestions),
    source: opponent.source,
  };
}
function applySuggestContent(
  fen: string,
  opening: boolean,
  suggestions: { move: string; reason: string }[],
): CoachResponse {
  return {
    summary: opening ? GAME_INTRO_TEXT : SUGGEST_PHASE_PROMPT,
    verdict: "neutral",
    followUpSteps: formatHintFollowUpSteps(fen, suggestions),
    source: "fallback",
  };
}

export function GameBoard({ level }: GameBoardProps) {
  const config = getDifficultyConfig(level);
  const [initial] = useState(() => createInitialState());
  const chessRef = useRef(initial.chess);

  const [fen, setFen] = useState(initial.fen);
  const [phase, setPhase] = useState<GamePhase>("suggest");
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [botLoading, setBotLoading] = useState(false);
  const [coachResponse, setCoachResponse] = useState<CoachResponse | null>(null);
  const [suggestedMoves, setSuggestedMoves] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(initial.gameOver);
  const [gameResult, setGameResult] = useState<string | null>(
    initial.gameResult,
  );
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(
    null,
  );
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const lastHintFenRef = useRef<string | null>(null);
  const hintFetchIdRef = useRef(0);
  const resumeBotRef = useRef(false);

  const isBusy = coachLoading || hintLoading || botLoading;

  const positionMeta = useMemo(() => {
    const chess = new Chess(fen);
    return {
      captured: getCapturedPieces(chess),
      turn: chess.turn(),
    };
  }, [fen]);

  const canUndo =
    !gameOver &&
    phase !== "bot" &&
    (pendingMove !== null || (!isBusy && moveCount > 0));

  const canNext =
    !gameOver &&
    !isBusy &&
    ((phase === "suggest" && pendingMove !== null) || phase === "review");

  const persistGame = useCallback(
    (
      nextFen: string,
      over: boolean,
      result: string | null,
      nextPhase: GamePhase = phase,
      nextPendingMove: PendingMove | null = pendingMove,
    ) => {
      const payload: SavedGameState = {
        fen: nextFen,
        gameOver: over,
        gameResult: result,
        phase: nextPhase,
        pendingMove: nextPendingMove,
      };
      sessionStorage.setItem(storageKey(level), JSON.stringify(payload));
    },
    [level, pendingMove, phase],
  );

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey(level));
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SavedGameState;
        chessRef.current.load(parsed.fen);
        startTransition(() => {
          setFen(parsed.fen);
          setGameOver(parsed.gameOver);
          setGameResult(parsed.gameResult);
          setLastMove(getLastMove(chessRef.current));
          setPhase(
            parsed.gameOver
              ? "review"
              : parsed.phase === "bot" || parsed.phase === "opponent"
                ? "suggest"
                : parsed.phase ?? "suggest",
          );
          setPendingMove(parsed.pendingMove ?? null);
          lastHintFenRef.current = null;
          setMoveCount(
            parsed.pendingMove
              ? parsed.pendingMove.fenBefore === DEFAULT_POSITION
                ? 0
                : 1
              : parsed.fen === DEFAULT_POSITION
                ? 0
                : 1,
          );
        });
      } catch {
        sessionStorage.removeItem(storageKey(level));
      }
    }
    startTransition(() => {
      setHydrated(true);
    });
  }, [level]);

  useEffect(() => {
    if (hydrated) {
      persistGame(chessRef.current.fen(), gameOver, gameResult);
    }
  }, [gameOver, gameResult, persistGame, hydrated, fen]);

  const canInteract =
    !isBusy && !gameOver && phase === "suggest" && pendingMove === null;

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    const chess = new Chess(fen);

    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: "var(--highlight-from)" };
      styles[lastMove.to] = { backgroundColor: "var(--highlight-from)" };
    }

    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: "var(--highlight-good)" };

      const moves = chess.moves({
        square: selectedSquare as Square,
        verbose: true,
      });

      for (const move of moves) {
        if (move.to === selectedSquare) {
          continue;
        }

        styles[move.to] = {
          ...styles[move.to],
          backgroundImage: move.captured
            ? "var(--move-dot-capture)"
            : "var(--move-dot-empty)",
        };
      }
    }

    return styles;
  }, [fen, lastMove, selectedSquare]);

  const applySuggestResponse = useCallback(
    (
      currentFen: string,
      opening: boolean,
      suggestions: { move: string; reason: string }[],
    ) => applySuggestContent(currentFen, opening, suggestions),
    [],
  );

  const applyFallbackHint = useCallback(
    (currentFen: string, opening: boolean) => {
      const fallbackSuggestions = getDefaultSuggestions(opening);
      setSuggestedMoves(fallbackSuggestions.map((suggestion) => suggestion.move));
      setCoachResponse(applySuggestResponse(currentFen, opening, fallbackSuggestions));
      lastHintFenRef.current = currentFen;
    },
    [applySuggestResponse],
  );

  const fetchHint = useCallback(async () => {
    const chess = chessRef.current;
    if (chess.turn() !== "w" || chess.isGameOver()) {
      return;
    }

    const fetchId = ++hintFetchIdRef.current;
    const currentFen = chess.fen();
    const opening = isOpeningPosition(chess);
    const defaultSuggestions = getDefaultSuggestions(opening);

    setCoachResponse((previous) => {
      if (previous !== null) {
        return previous;
      }

      return applySuggestResponse(currentFen, opening, defaultSuggestions);
    });

    if (defaultSuggestions.length > 0) {
      setSuggestedMoves(defaultSuggestions.map((suggestion) => suggestion.move));
    }

    setHintLoading(true);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    try {
      const analysisResponse = await fetch("/api/engine/analyze-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fen: currentFen,
          skillLevel: config.skillLevel,
        }),
        signal: controller.signal,
      });

      const analysis = (await analysisResponse.json()) as PositionAnalysis & {
        error?: string;
      };
      if (!analysisResponse.ok) {
        throw new Error(analysis.error ?? "Analyse mislukt");
      }

      const suggestions = buildSuggestionsFromAnalysis(currentFen, analysis);

      if (fetchId !== hintFetchIdRef.current) {
        return;
      }

      setSuggestedMoves(suggestions.map((suggestion) => suggestion.move));
      setCoachResponse(applySuggestResponse(currentFen, opening, suggestions));
      lastHintFenRef.current = currentFen;
    } catch {
      if (fetchId === hintFetchIdRef.current) {
        applyFallbackHint(currentFen, opening);
      }
    } finally {
      window.clearTimeout(timeout);
      if (fetchId === hintFetchIdRef.current) {
        setHintLoading(false);
      }
    }
  }, [applyFallbackHint, applySuggestResponse, config.skillLevel]);

  const fetchCoachFeedback = useCallback(
    async (move: PendingMove) => {
      setCoachLoading(true);

      try {
        const analysisResponse = await fetch("/api/engine/analyze-move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fenBefore: move.fenBefore,
            fenAfter: chessRef.current.fen(),
            playedMoveUci: move.playedMoveUci,
            skillLevel: config.skillLevel,
          }),
        });

        const analysisData = (await analysisResponse.json()) as
          | MoveAnalysis
          | { error?: string };

        if (!analysisResponse.ok || !("classification" in analysisData)) {
          throw new Error(
            "error" in analysisData ? analysisData.error : "Analyse mislukt.",
          );
        }

        const followedSuggestion = playedMoveMatchesSuggestion(
          move.fenBefore,
          move.playedMoveUci,
          suggestedMoves,
        );

        const response = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fen: chessRef.current.fen(),
            fenBefore: move.fenBefore,
            moveSan: move.moveSan,
            level,
            analysis: analysisData,
            suggestedMoves,
            followedSuggestion,
            isGameOver: move.isOver,
            gameResult: move.result,
          }),
        });

        const coach = (await response.json()) as CoachResponse;
        setCoachResponse(coach);
      } catch {
        setCoachResponse({
          summary: `Je speelde **${move.moveSan}**. Analyse is tijdelijk niet beschikbaar, maar je kunt gewoon verder spelen.`,
          verdict: "neutral",
          followUpSteps: [],
          source: "fallback",
        });
      } finally {
        setCoachLoading(false);
      }
    },
    [config.skillLevel, level, suggestedMoves],
  );

  const loadSuggestionsForPosition = useCallback(
    async (currentFen: string, signal?: AbortSignal) => {
      const analysisResponse = await fetch("/api/engine/analyze-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fen: currentFen,
          skillLevel: config.skillLevel,
        }),
        signal,
      });

      const analysis = (await analysisResponse.json()) as PositionAnalysis & {
        error?: string;
      };

      if (!analysisResponse.ok) {
        throw new Error(analysis.error ?? "Analyse mislukt");
      }

      return buildSuggestionsFromAnalysis(currentFen, analysis);
    },
    [config.skillLevel],
  );

  const requestOpponentAnalysis = useCallback(
    async (
      fenBeforeBot: string,
      moveSan: string,
      moveUci: string,
      isCheck: boolean,
      isCapture: boolean,
    ): Promise<CoachResponse> => {
      const response = await fetch("/api/coach/opponent-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fen: chessRef.current.fen(),
          fenBefore: fenBeforeBot,
          moveSan,
          moveUci,
          level,
          isCheck,
          isCapture,
        }),
      });

      return (await response.json()) as CoachResponse;
    },
    [level],
  );

  const fetchAfterBotMove = useCallback(
    async (
      fenBeforeBot: string,
      moveSan: string,
      moveUci: string,
      isCheck: boolean,
      isCapture: boolean,
    ) => {
      const currentFen = chessRef.current.fen();
      setPhase("suggest");
      setCoachLoading(true);
      setHintLoading(true);

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);

      try {
        const [opponent, suggestions] = await Promise.all([
          requestOpponentAnalysis(
            fenBeforeBot,
            moveSan,
            moveUci,
            isCheck,
            isCapture,
          ),
          loadSuggestionsForPosition(currentFen, controller.signal),
        ]);

        const finalSuggestions =
          suggestions.length > 0 ? suggestions : getDefaultSuggestions(false);

        setSuggestedMoves(finalSuggestions.map((suggestion) => suggestion.move));
        setCoachResponse(
          mergeBotAnalysisWithSuggestions(opponent, currentFen, finalSuggestions),
        );
        lastHintFenRef.current = currentFen;
      } catch {
        const fallbackSuggestions = getDefaultSuggestions(false);
        setSuggestedMoves(fallbackSuggestions.map((suggestion) => suggestion.move));
        setCoachResponse(
          mergeBotAnalysisWithSuggestions(
            {
              summary: buildOpponentMoveSummary(fenBeforeBot, moveSan),
              verdict: "neutral",
              followUpSteps: [],
              source: "fallback",
            },
            currentFen,
            fallbackSuggestions,
          ),
        );
        lastHintFenRef.current = currentFen;
      } finally {
        window.clearTimeout(timeout);
        setCoachLoading(false);
        setHintLoading(false);
      }
    },
    [loadSuggestionsForPosition, requestOpponentAnalysis],
  );

  const playBotMove = useCallback(async () => {
    const chess = chessRef.current;
    if (chess.isGameOver() || chess.turn() !== "b") {
      return;
    }

    setBotLoading(true);
    setError(null);

    const applyBotMove = async (bestMove: string) => {
      const fenBeforeBot = chess.fen();
      const from = bestMove.slice(0, 2);
      const to = bestMove.slice(2, 4);
      const promotion = bestMove.length > 4 ? bestMove[4] : undefined;

      const botMove = chess.move({
        from,
        to,
        promotion: promotion as "q" | "r" | "b" | "n" | undefined,
      });

      if (!botMove) {
        throw new Error("Bot-zet kon niet worden uitgevoerd.");
      }

      setFen(chess.fen());
      setLastMove({ from, to });
      setMoveCount((count) => count + 1);

      if (chess.isGameOver()) {
        const result = getGameResult(chess);
        setGameOver(true);
        setGameResult(result);
        setCoachResponse({
          summary: result,
          verdict: "neutral",
          followUpSteps: [],
          source: "fallback",
        });
        setPhase("review");
        return;
      }

      await fetchAfterBotMove(
        fenBeforeBot,
        botMove.san,
        bestMove,
        botMove.san.includes("+"),
        Boolean(botMove.captured),
      );
    };

    const pickLocalMove = () => {
      const moves = chess.moves({ verbose: true });
      if (moves.length === 0) {
        return null;
      }

      const weakerPool = Math.max(
        1,
        Math.ceil(moves.length * (1 - config.skillLevel / 20)),
      );
      const move = moves[Math.floor(Math.random() * weakerPool)];
      return `${move.from}${move.to}${move.promotion ?? ""}`;
    };

    try {
      await new Promise((resolve) => setTimeout(resolve, 400));

      const response = await fetch("/api/engine/best-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fen: chess.fen(),
          skillLevel: config.skillLevel,
        }),
      });

      const data = (await response.json()) as {
        bestMove?: string;
        error?: string;
      };

      if (response.ok && data.bestMove) {
        await applyBotMove(data.bestMove);
        return;
      }

      const localMove = pickLocalMove();
      if (localMove) {
        await applyBotMove(localMove);
        return;
      }

      throw new Error(data.error ?? "Geen bot-zet ontvangen.");
    } catch {
      const localMove = pickLocalMove();
      if (localMove) {
        await applyBotMove(localMove);
        return;
      }

      setError("De bot kon geen zet vinden.");
      setPhase("review");
    } finally {
      setBotLoading(false);
    }
  }, [config.skillLevel, fetchAfterBotMove]);

  useEffect(() => {
    if (!hydrated || gameOver || phase !== "suggest" || pendingMove) {
      return;
    }

    if (chessRef.current.turn() === "w") {
      return;
    }

    if (resumeBotRef.current) {
      return;
    }

    resumeBotRef.current = true;
    setPhase("bot");
    void playBotMove().finally(() => {
      resumeBotRef.current = false;
    });
  }, [fen, gameOver, hydrated, pendingMove, phase, playBotMove]);

  useEffect(() => {
    if (!hydrated || gameOver || phase !== "suggest" || pendingMove) {
      return;
    }

    if (chessRef.current.turn() !== "w") {
      return;
    }

    const currentFen = chessRef.current.fen();

    if (lastHintFenRef.current === currentFen) {
      return;
    }

    void fetchHint();
  }, [fen, fetchHint, gameOver, hydrated, pendingMove, phase]);

  const handleNext = useCallback(async () => {
    if (phase === "suggest" && pendingMove) {
      setSelectedSquare(null);
      setPhase("review");
      await fetchCoachFeedback(pendingMove);

      if (pendingMove.isOver) {
        setGameOver(true);
        setGameResult(pendingMove.result);
        setPendingMove(null);
      }
      return;
    }

    if (phase === "review" && !pendingMove?.isOver && !gameOver) {
      setPendingMove(null);
      setPhase("bot");
      await playBotMove();
    }
  }, [
    fetchCoachFeedback,
    gameOver,
    pendingMove,
    phase,
    playBotMove,
  ]);

  const handlePlayerMove = useCallback(
    (sourceSquare: string, targetSquare: string, pieceType: string) => {
      if (isBusy || gameOver || phase !== "suggest" || pendingMove) {
        return false;
      }

      const chess = chessRef.current;
      if (chess.turn() !== "w") {
        return false;
      }

      const promotion =
        pieceType[1]?.toLowerCase() === "p" && targetSquare[1] === "8"
          ? "q"
          : undefined;

      const fenBefore = chess.fen();
      let move;

      try {
        move = chess.move({
          from: sourceSquare,
          to: targetSquare,
          promotion,
        });
      } catch {
        setCoachResponse({
          summary: "Die zet is niet volgens de regels. Probeer een andere zet.",
          verdict: "neutral",
          followUpSteps: [],
          source: "fallback",
        });
        return false;
      }

      if (!move) {
        return false;
      }

      setFen(chess.fen());
      setLastMove({ from: sourceSquare, to: targetSquare });
      setSelectedSquare(null);

      const isOver = chess.isGameOver();
      const result = isOver ? getGameResult(chess) : null;

      setPendingMove({
        fenBefore,
        moveSan: move.san,
        playedMoveUci: `${sourceSquare}${targetSquare}${promotion ?? ""}`,
        isOver,
        result,
      });
      setMoveCount((count) => count + 1);

      return true;
    },
    [gameOver, isBusy, pendingMove, phase],
  );

  const selectSquare = useCallback((square: string) => {
    const chess = chessRef.current;
    const piece = chess.get(square as Square);

    if (!piece || piece.color !== "w") {
      setSelectedSquare(null);
      return;
    }

    const moves = chess.moves({ square: square as Square, verbose: true });
    if (moves.length === 0) {
      setSelectedSquare(null);
      return;
    }

    setSelectedSquare(square);
  }, []);

  const handleSquareClick = useCallback(
    ({ square, piece }: { square: string; piece: { pieceType: string } | null }) => {
      if (!canInteract || chessRef.current.turn() !== "w") {
        return;
      }

      const chess = chessRef.current;

      if (selectedSquare) {
        if (square === selectedSquare) {
          setSelectedSquare(null);
          return;
        }

        const legalMove = chess
          .moves({ square: selectedSquare as Square, verbose: true })
          .find((move) => move.to === square);

        if (legalMove) {
          handlePlayerMove(
            selectedSquare,
            square,
            pieceTypeFromSquare(chess, selectedSquare),
          );
          return;
        }

        if (piece && isWhitePieceType(piece.pieceType)) {
          selectSquare(square);
          return;
        }

        setSelectedSquare(null);
        return;
      }

      if (piece && isWhitePieceType(piece.pieceType)) {
        selectSquare(square);
      }
    },
    [canInteract, handlePlayerMove, selectSquare, selectedSquare],
  );

  const handleUndo = useCallback(() => {
    if (!canUndo) {
      return;
    }

    const chess = chessRef.current;

    if (pendingMove && (phase === "suggest" || phase === "review")) {
      chess.load(pendingMove.fenBefore);
      setFen(pendingMove.fenBefore);
      setLastMove(getLastMove(chess));
      setPendingMove(null);
      setPhase("suggest");
      setSelectedSquare(null);
      setMoveCount((count) => Math.max(0, count - 1));
      lastHintFenRef.current = null;
      setGameOver(false);
      setGameResult(null);
      setError(null);
      return;
    }

    if (chess.turn() === "b") {
      chess.undo();
      setMoveCount((count) => Math.max(0, count - 1));
    } else if (chess.history().length >= 2) {
      chess.undo();
      chess.undo();
      setMoveCount((count) => Math.max(0, count - 2));
    } else if (chess.history().length > 0) {
      chess.undo();
      setMoveCount((count) => Math.max(0, count - 1));
    } else {
      return;
    }

    setFen(chess.fen());
    setLastMove(getLastMove(chess));
    setPendingMove(null);
    setPhase("suggest");
    setSelectedSquare(null);
    lastHintFenRef.current = null;
    setGameOver(false);
    setGameResult(null);
    setError(null);
  }, [canUndo, pendingMove, phase]);

  const resetGame = () => {
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setCoachResponse(null);
    setSuggestedMoves([]);
    setPhase("suggest");
    setPendingMove(null);
    setGameOver(false);
    setGameResult(null);
    setLastMove(null);
    setMoveCount(0);
    setSelectedSquare(null);
    setError(null);
    setCoachLoading(false);
    setHintLoading(false);
    setBotLoading(false);
    lastHintFenRef.current = null;
    resumeBotRef.current = false;
    sessionStorage.removeItem(storageKey(level));
  };

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted">
        Partij laden...
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col bg-white lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6 lg:px-6 lg:py-4">
        <div className="flex min-w-0 flex-col">
          <PlayerBar
            variant="opponent"
            name={`Bot · ${config.title}`}
            rating={config.elo}
            captured={positionMeta.captured.byBlack}
            capturedPieceColor="w"
            materialPlus={capturedMaterialAdvantage(
              positionMeta.captured,
              "b",
            )}
          />

          <div className="chessboard-fancy px-1 pb-1 lg:px-0">
            <Chessboard
              options={{
                position: fen,
                boardOrientation: "white",
                pieces: fancyPieces,
                allowDragging: false,
                animationDurationInMs: 200,
                showNotation: true,
                onSquareClick: handleSquareClick,
                squareStyles,
                darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                lightSquareStyle: { backgroundColor: "var(--board-light)" },
                darkSquareNotationStyle: { color: "#eeeed2", opacity: 0.85 },
                lightSquareNotationStyle: { color: "#516639", opacity: 0.9 },
                alphaNotationStyle: {
                  fontSize: "11px",
                  fontWeight: 600,
                },
                numericNotationStyle: {
                  fontSize: "11px",
                  fontWeight: 600,
                },
                boardStyle: {
                  cursor: canInteract ? "pointer" : "default",
                  maxWidth: "640px",
                  margin: "0 auto",
                  width: "100%",
                },
              }}
            />
          </div>

          <PlayerBar
            variant="user"
            name="Jij"
            captured={positionMeta.captured.byWhite}
            capturedPieceColor="b"
            materialPlus={capturedMaterialAdvantage(
              positionMeta.captured,
              "w",
            )}
          />

          <GameControls
            onUndo={handleUndo}
            onNext={() => void handleNext()}
            canUndo={canUndo}
            canNext={canNext}
            nextLoading={coachLoading || botLoading}
          />

          {error && (
            <p className="px-3 pb-2 text-center text-xs text-red-600">{error}</p>
          )}
        </div>

        <div className="flex flex-col lg:sticky lg:top-6 lg:self-start">
          <CoachBubble
            loading={
              coachLoading ||
              botLoading ||
              hintLoading ||
              (phase === "suggest" && coachResponse === null && !pendingMove)
            }
            loadingText={
              botLoading
                ? "Computer zet..."
                : coachLoading && hintLoading
                  ? "Bot-zet analyseren..."
                  : undefined
            }
            phase={phase}
            response={coachResponse}
            moveMade={phase === "suggest" && pendingMove !== null}
            onNewGame={resetGame}
            showNewGame={gameOver}
          />
        </div>
      </div>
    </>
  );
}
