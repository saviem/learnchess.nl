"use client";

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, DEFAULT_POSITION } from "chess.js";
import { PlayerBar } from "@/components/game/PlayerBar";
import { CoachBubble } from "@/components/game/CoachBubble";
import {
  CapturedPiecesDisplay,
  GameControls,
} from "@/components/game/CapturedPieces";
import {
  getDifficultyConfig,
  type DifficultyLevel,
} from "@/lib/chess/difficulty";
import { getCapturedPieces } from "@/lib/chess/captures";
import type { CoachResponse, HintResponse } from "@/lib/coach/types";
import type { MoveAnalysis } from "@/lib/coach/types";
import { formatHintFollowUpSteps } from "@/lib/coach/prompt";
import { buildOpponentMoveSummary, playedMoveMatchesSuggestion } from "@/lib/chess/move-language";

interface SavedGameState {
  fen: string;
  gameOver: boolean;
  gameResult: string | null;
}

interface PendingMove {
  fenBefore: string;
  moveSan: string;
  playedMoveUci: string;
  isOver: boolean;
  result: string | null;
}

interface GameBoardProps {
  level: DifficultyLevel;
}

type GamePhase = "suggest" | "review" | "bot" | "opponent";

function storageKey(level: DifficultyLevel) {
  return `learnchess-game-${level}`;
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
  const [hintPlan, setHintPlan] = useState<string>("");
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
  const lastHintFenRef = useRef<string | null>(null);
  const hintFetchIdRef = useRef(0);

  const isBusy = coachLoading || hintLoading || botLoading;

  const positionMeta = useMemo(() => {
    const chess = new Chess(fen);
    return {
      captured: getCapturedPieces(chess),
      historyLength: chess.history().length,
      turn: chess.turn(),
    };
  }, [fen]);

  const canUndo =
    !isBusy &&
    !gameOver &&
    positionMeta.historyLength > 0 &&
    phase !== "bot" &&
    phase !== "opponent";

  const canNext =
    !gameOver &&
    !isBusy &&
    ((phase === "suggest" && pendingMove !== null) ||
      phase === "review" ||
      phase === "opponent");

  const persistGame = useCallback(
    (nextFen: string, over: boolean, result: string | null) => {
      const payload: SavedGameState = {
        fen: nextFen,
        gameOver: over,
        gameResult: result,
      };
      sessionStorage.setItem(storageKey(level), JSON.stringify(payload));
    },
    [level],
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
          setPhase(parsed.gameOver ? "review" : "suggest");
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

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: "var(--highlight-from)" };
      styles[lastMove.to] = { backgroundColor: "var(--highlight-from)" };
    }

    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: "var(--highlight-good)" };
    }

    return styles;
  }, [lastMove, selectedSquare]);

  const applyFallbackHint = useCallback((currentFen: string) => {
    const fallbackSuggestions = [
      { move: "e4", reason: "" },
      { move: "Nf3", reason: "" },
    ];
    setSuggestedMoves(fallbackSuggestions.map((suggestion) => suggestion.move));
    setCoachResponse({
      summary:
        "Kijk naar het midden van het bord en welke stukken je nog moet zetten.",
      verdict: "neutral",
      followUpSteps: formatHintFollowUpSteps(currentFen, fallbackSuggestions),
      source: "fallback",
    });
    setHintPlan("Zet je stukken in het spel en zorg dat je koning veilig staat.");
  }, []);

  const fetchHint = useCallback(async () => {
    const chess = chessRef.current;
    if (chess.turn() !== "w" || chess.isGameOver()) {
      return;
    }

    const fetchId = ++hintFetchIdRef.current;
    const currentFen = chess.fen();
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

      const analysis = await analysisResponse.json();
      if (!analysisResponse.ok) {
        throw new Error(analysis.error ?? "Analyse mislukt");
      }

      const hintResponse = await fetch("/api/coach/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fen: currentFen,
          level,
          analysis,
        }),
        signal: controller.signal,
      });

      if (fetchId !== hintFetchIdRef.current) {
        return;
      }

      const hint = (await hintResponse.json()) as HintResponse;
      setHintPlan(hint.plan);
      setSuggestedMoves(hint.suggestions.map((suggestion) => suggestion.move));
      setCoachResponse({
        summary: hint.summary,
        verdict: "neutral",
        followUpSteps: formatHintFollowUpSteps(currentFen, hint.suggestions),
        source: hint.source,
      });
    } catch {
      if (fetchId === hintFetchIdRef.current) {
        applyFallbackHint(currentFen);
      }
    } finally {
      window.clearTimeout(timeout);
      if (fetchId === hintFetchIdRef.current) {
        setHintLoading(false);
      }
    }
  }, [applyFallbackHint, config.skillLevel, level]);

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

    lastHintFenRef.current = currentFen;
    void fetchHint();
  }, [fen, hydrated, gameOver, phase, pendingMove, fetchHint]);

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

  const fetchOpponentMoveExplanation = useCallback(
    async (
      fenBeforeBot: string,
      moveSan: string,
      moveUci: string,
      isCheck: boolean,
      isCapture: boolean,
    ) => {
      setCoachLoading(true);

      try {
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

        const coach = (await response.json()) as CoachResponse;
        setCoachResponse(coach);
      } catch {
        setCoachResponse({
          summary: buildOpponentMoveSummary(fenBeforeBot, moveSan),
          verdict: "neutral",
          followUpSteps: ["Kijk wat de bot dreigt", "Denk aan je volgende zet"],
          source: "fallback",
        });
      } finally {
        setCoachLoading(false);
      }
    },
    [level],
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

      setPhase("opponent");
      await fetchOpponentMoveExplanation(
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
  }, [config.skillLevel, fetchOpponentMoveExplanation]);

  const handleNext = useCallback(async () => {
    if (phase === "suggest" && pendingMove) {
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
      return;
    }

    if (phase === "opponent") {
      setPhase("suggest");
      lastHintFenRef.current = null;
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
      setSelectedSquare(targetSquare);

      const isOver = chess.isGameOver();
      const result = isOver ? getGameResult(chess) : null;

      setPendingMove({
        fenBefore,
        moveSan: move.san,
        playedMoveUci: `${sourceSquare}${targetSquare}${promotion ?? ""}`,
        isOver,
        result,
      });

      return true;
    },
    [gameOver, isBusy, pendingMove, phase],
  );

  const handleUndo = useCallback(() => {
    if (!canUndo) {
      return;
    }

    const chess = chessRef.current;

    if (phase === "review" && pendingMove) {
      chess.undo();
      setFen(chess.fen());
      setLastMove(getLastMove(chess));
      setPendingMove(null);
      setPhase("suggest");
      lastHintFenRef.current = null;
      setError(null);
      return;
    }

    if (chess.turn() === "b") {
      chess.undo();
    } else if (chess.history().length >= 2) {
      chess.undo();
      chess.undo();
    } else {
      chess.undo();
    }

    setFen(chess.fen());
    setLastMove(getLastMove(chess));
    setPendingMove(null);
    setPhase("suggest");
    lastHintFenRef.current = null;
    setGameOver(false);
    setGameResult(null);
    setError(null);
  }, [canUndo, pendingMove, phase]);

  const resetGame = () => {
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setCoachResponse(null);
    setHintPlan("");
    setSuggestedMoves([]);
    setPhase("suggest");
    setPendingMove(null);
    setGameOver(false);
    setGameResult(null);
    setLastMove(null);
    setSelectedSquare(null);
    setError(null);
    setCoachLoading(false);
    setHintLoading(false);
    setBotLoading(false);
    lastHintFenRef.current = null;
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
      <PlayerBar elo={config.elo} />

      <CapturedPiecesDisplay captured={positionMeta.captured} />

      <div className="px-3 py-3">
        <Chessboard
          options={{
            position: fen,
            boardOrientation: "white",
            allowDragging:
              !isBusy &&
              !gameOver &&
              phase === "suggest" &&
              pendingMove === null,
            animationDurationInMs: 200,
            onPieceDrop: ({ sourceSquare, targetSquare, piece }) => {
              if (!targetSquare) {
                return false;
              }
              return handlePlayerMove(
                sourceSquare,
                targetSquare,
                piece.pieceType,
              );
            },
            onSquareClick: ({ square }) => {
              if (!isBusy && !gameOver && phase === "suggest" && !pendingMove) {
                setSelectedSquare(square);
              }
            },
            squareStyles,
            darkSquareStyle: { backgroundColor: "var(--board-dark)" },
            lightSquareStyle: { backgroundColor: "var(--board-light)" },
            boardStyle: {
              borderRadius: "12px",
              boxShadow: "0 4px 20px rgba(15, 23, 42, 0.08)",
            },
          }}
        />
      </div>

      <GameControls
        onUndo={handleUndo}
        onNext={() => void handleNext()}
        canUndo={canUndo}
        canNext={canNext}
        nextLoading={coachLoading || botLoading}
      />

      {error && (
        <p className="px-4 text-center text-xs text-red-600">{error}</p>
      )}

      <CoachBubble
        loading={isBusy}
        phase={phase}
        response={coachResponse}
        hintPlan={phase === "suggest" ? hintPlan : undefined}
        moveMade={phase === "suggest" && pendingMove !== null}
        showOpponentTips={phase === "opponent"}
        onNewGame={resetGame}
        showNewGame={gameOver}
      />
    </>
  );
}
