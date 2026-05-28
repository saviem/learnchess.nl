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

const INITIAL_TIME = 600;

interface SavedGameState {
  fen: string;
  secondsLeft: number;
  gameOver: boolean;
  gameResult: string | null;
}

interface GameBoardProps {
  level: DifficultyLevel;
}

type BubblePanel = "main" | "variant" | "blunder" | "next";
type BubbleMode = "feedback" | "hint";

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
    secondsLeft: INITIAL_TIME,
    timerRunning: true,
    gameOver: false,
    gameResult: null as string | null,
  };
}

export function GameBoard({ level }: GameBoardProps) {
  const config = getDifficultyConfig(level);
  const [initial] = useState(() => createInitialState());
  const chessRef = useRef(initial.chess);

  const [fen, setFen] = useState(initial.fen);
  const [thinking, setThinking] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [coachResponse, setCoachResponse] = useState<CoachResponse | null>(null);
  const [hintPlan, setHintPlan] = useState<string>("");
  const [bubbleMode, setBubbleMode] = useState<BubbleMode>("hint");
  const [bubblePanel, setBubblePanel] = useState<BubblePanel>("main");
  const [secondsLeft, setSecondsLeft] = useState(initial.secondsLeft);
  const [timerRunning, setTimerRunning] = useState(initial.timerRunning);
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

  const positionMeta = useMemo(() => {
    const chess = new Chess(fen);
    return {
      captured: getCapturedPieces(chess),
      historyLength: chess.history().length,
      turn: chess.turn(),
    };
  }, [fen]);

  const canUndo =
    !thinking &&
    !coachLoading &&
    !gameOver &&
    positionMeta.historyLength > 0;

  const canHint =
    !thinking && !coachLoading && !gameOver && positionMeta.turn === "w";

  const persistGame = useCallback(
    (nextFen: string, time: number, over: boolean, result: string | null) => {
      const payload: SavedGameState = {
        fen: nextFen,
        secondsLeft: time,
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
          setSecondsLeft(parsed.secondsLeft);
          setGameOver(parsed.gameOver);
          setGameResult(parsed.gameResult);
          setTimerRunning(!parsed.gameOver);
          setLastMove(getLastMove(chessRef.current));
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
    if (!timerRunning || thinking || gameOver) {
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setGameOver(true);
          setGameResult("Je tijd is op — de bot wint.");
          setTimerRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timerRunning, thinking, gameOver]);

  useEffect(() => {
    if (hydrated) {
      persistGame(chessRef.current.fen(), secondsLeft, gameOver, gameResult);
    }
  }, [secondsLeft, gameOver, gameResult, persistGame, hydrated, fen]);

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

  const fetchHint = useCallback(async () => {
    const chess = chessRef.current;
    if (chess.turn() !== "w" || chess.isGameOver()) {
      return;
    }

    setHintLoading(true);
    setBubbleMode("hint");
    setBubblePanel("main");

    try {
      const analysisResponse = await fetch("/api/engine/analyze-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fen: chess.fen(),
          skillLevel: config.skillLevel,
        }),
      });

      const analysis = await analysisResponse.json();
      if (!analysisResponse.ok) {
        throw new Error(analysis.error ?? "Analyse mislukt");
      }

      const hintResponse = await fetch("/api/coach/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fen: chess.fen(),
          level,
          analysis,
        }),
      });

      const hint = (await hintResponse.json()) as HintResponse;
      setHintPlan(hint.plan);
      setCoachResponse({
        summary: hint.summary,
        verdict: "neutral",
        followUpSteps: formatHintFollowUpSteps(chess.fen(), hint.suggestions),
        source: hint.source,
      });
    } catch {
      setCoachResponse({
        summary:
          "Kijk naar het midden van het bord en welke stukken je nog moet zetten. Open **Suggesties** om te zien welk stuk je waarheen kunt zetten.",
        verdict: "neutral",
        followUpSteps: formatHintFollowUpSteps(chess.fen(), [
          { move: "e4", reason: "" },
          { move: "Nf3", reason: "" },
        ]),
        source: "fallback",
      });
      setHintPlan("Zet je stukken in het spel en zorg dat je koning veilig staat.");
    } finally {
      setHintLoading(false);
    }
  }, [config.skillLevel, level]);

  useEffect(() => {
    if (!hydrated || thinking || coachLoading || gameOver) {
      return;
    }

    if (chessRef.current.turn() === "w") {
      void fetchHint();
    }
  }, [fen, hydrated, thinking, coachLoading, gameOver, fetchHint]);

  const playBotMove = useCallback(async () => {
    const chess = chessRef.current;
    if (chess.isGameOver() || chess.turn() !== "b") {
      return;
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, 700));

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
      if (!response.ok || !data.bestMove) {
        throw new Error(data.error ?? "Geen bot-zet ontvangen.");
      }

      const bestMove = data.bestMove;
      const from = bestMove.slice(0, 2);
      const to = bestMove.slice(2, 4);
      const promotion = bestMove.length > 4 ? bestMove[4] : undefined;

      chess.move({
        from,
        to,
        promotion: promotion as "q" | undefined,
      });

      setFen(chess.fen());
      setLastMove({ from, to });

      if (chess.isGameOver()) {
        const result = getGameResult(chess);
        setGameOver(true);
        setGameResult(result);
        setTimerRunning(false);
        setBubbleMode("feedback");
        setCoachResponse({
          summary: result,
          verdict: "neutral",
          followUpSteps: [],
          source: "fallback",
        });
      }
    } catch {
      setError("De bot kon geen zet vinden.");
    }
  }, [config.skillLevel]);

  const processMoveAsync = useCallback(
    async (
      fenBefore: string,
      moveSan: string,
      playedMoveUci: string,
      isOver: boolean,
      result: string | null,
    ) => {
      setCoachLoading(true);
      setBubbleMode("feedback");
      setBubblePanel("main");
      setThinking(true);

      try {
        const analysisResponse = await fetch("/api/engine/analyze-move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fenBefore,
            fenAfter: chessRef.current.fen(),
            playedMoveUci,
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

        const response = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fen: chessRef.current.fen(),
            moveSan,
            level,
            analysis: analysisData,
            isGameOver: isOver,
            gameResult: result,
          }),
        });

        const coach = (await response.json()) as CoachResponse;
        setCoachResponse(coach);
      } catch {
        setCoachResponse({
          summary: `Je speelde **${moveSan}**. Analyse is tijdelijk niet beschikbaar, maar je kunt gewoon verder spelen.`,
          verdict: "neutral",
          followUpSteps: [
            "Blijf het centrum controleren",
            "Ontwikkel je lichte stukken",
          ],
          source: "fallback",
        });
      } finally {
        setCoachLoading(false);
      }

      if (!isOver) {
        await playBotMove();
      }

      setThinking(false);
    },
    [config.skillLevel, level, playBotMove],
  );

  const handlePlayerMove = useCallback(
    (sourceSquare: string, targetSquare: string, pieceType: string) => {
      if (thinking || coachLoading || hintLoading || gameOver) {
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
        setBubbleMode("feedback");
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

      if (isOver) {
        setGameOver(true);
        setGameResult(result);
        setTimerRunning(false);
      }

      void processMoveAsync(
        fenBefore,
        move.san,
        `${sourceSquare}${targetSquare}${promotion ?? ""}`,
        isOver,
        result,
      );

      return true;
    },
    [coachLoading, gameOver, hintLoading, processMoveAsync, thinking],
  );

  const handleUndo = useCallback(() => {
    if (!canUndo) {
      return;
    }

    const chess = chessRef.current;

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
    setGameOver(false);
    setGameResult(null);
    setTimerRunning(true);
    setError(null);
    setBubblePanel("main");
  }, [canUndo]);

  const resetGame = () => {
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setCoachResponse(null);
    setHintPlan("");
    setBubbleMode("hint");
    setBubblePanel("main");
    setSecondsLeft(INITIAL_TIME);
    setTimerRunning(true);
    setGameOver(false);
    setGameResult(null);
    setLastMove(null);
    setSelectedSquare(null);
    setError(null);
    setThinking(false);
    setCoachLoading(false);
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
      <PlayerBar
        elo={config.elo}
        secondsLeft={secondsLeft}
        running={timerRunning}
      />

      <CapturedPiecesDisplay captured={positionMeta.captured} />

      <div className="px-3 py-3">
        <Chessboard
          options={{
            position: fen,
            boardOrientation: "white",
            allowDragging: !thinking && !coachLoading && !hintLoading && !gameOver,
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
              if (!thinking && !gameOver) {
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
        onHint={() => void fetchHint()}
        canUndo={canUndo}
        canHint={canHint}
        hintLoading={hintLoading}
      />

      {error && (
        <p className="px-4 text-center text-xs text-red-600">{error}</p>
      )}

      <CoachBubble
        loading={coachLoading || thinking || hintLoading}
        response={coachResponse}
        activePanel={bubblePanel}
        onPanelChange={setBubblePanel}
        onNewGame={resetGame}
        showNewGame={gameOver}
        mode={bubbleMode}
        hintPlan={hintPlan}
      />
    </>
  );
}
