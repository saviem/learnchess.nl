import { createRequire } from "node:module";
import { Chess } from "chess.js";
import { classifyMove, evalFromWhitePerspective, parseScore } from "@/lib/chess/analysis";
import type { MoveAnalysis } from "@/lib/coach/types";

const require = createRequire(import.meta.url);
const initEngine = require("stockfish") as (
  flavor: string,
  callback: (error: Error | null, engine: StockfishProcess) => void,
) => StockfishProcess;

interface StockfishProcess {
  sendCommand: (command: string) => void;
  listener?: (message: string) => void;
}

interface SearchResult {
  evalScore: number;
  bestMove: string;
  alternatives: string[];
  pv: string[];
}

let engineReady: Promise<StockfishProcess> | null = null;
let engineInstance: StockfishProcess | null = null;
let commandChain: Promise<unknown> = Promise.resolve();

const ENGINE_FLAVOR = process.env.STOCKFISH_FLAVOR ?? "asm";

function recoverEngine() {
  commandChain = Promise.resolve();
  engineInstance?.sendCommand("stop");
}

function normalizeLine(message: string): string {
  return message.trim();
}

function fallbackBestMove(fen: string, skillLevel: number): string {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    return "";
  }

  const weakerPool = Math.max(
    1,
    Math.ceil(moves.length * (1 - skillLevel / 20)),
  );
  const move = moves[Math.floor(Math.random() * weakerPool)];

  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function fallbackAnalysis(fen: string, skillLevel: number): SearchResult {
  const bestMove = fallbackBestMove(fen, skillLevel);
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });

  return {
    evalScore: 0,
    bestMove,
    alternatives: moves.slice(0, 3).map((move) => `${move.from}${move.to}`),
    pv: bestMove ? [bestMove] : [],
  };
}

function getEngine(): Promise<StockfishProcess> {
  if (engineReady) {
    return engineReady;
  }

  engineReady = new Promise<StockfishProcess>((resolve, reject) => {
    let settled = false;

    initEngine(ENGINE_FLAVOR, (error, engine) => {
      if (error || !engine) {
        if (!settled) {
          settled = true;
          reject(error ?? new Error("Stockfish kon niet starten."));
        }
        return;
      }

      let uciOk = false;

      engine.listener = (message) => {
        const line = normalizeLine(message);
        if (!line) {
          return;
        }

        if (line === "uciok") {
          uciOk = true;
          engine.sendCommand("isready");
        }

        if (line === "readyok" && uciOk && !settled) {
          settled = true;
          engineInstance = engine;
          resolve(engine);
        }
      };

      engine.sendCommand("uci");
    });

    setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Stockfish server timeout bij opstarten."));
      }
    }, 15000);
  });

  return engineReady;
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = commandChain.then(task, task);
  commandChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function runCommands(
  commands: string[],
  stopOn: (line: string) => boolean,
  timeoutMs = 20000,
): Promise<string[]> {
  return enqueue(async () => {
    const engine = await getEngine();
    const lines: string[] = [];

    return await new Promise<string[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        recoverEngine();
        reject(new Error("Stockfish analyse timeout."));
      }, timeoutMs);

      engine.listener = (message) => {
        const line = normalizeLine(message);
        if (!line) {
          return;
        }
        lines.push(line);
        if (stopOn(line)) {
          clearTimeout(timeout);
          resolve(lines);
        }
      };

      for (const command of commands) {
        engine.sendCommand(command);
      }
    });
  });
}

function extractBestInfoLines(lines: string[]): string[] {
  const byPv = new Map<number, string>();

  for (const line of lines) {
    const pvMatch = line.match(/multipv (\d+)/);
    const depthMatch = line.match(/ depth (\d+)/);
    const scoreMatch = line.match(/score (?:cp|mate) -?\d+/);

    if (!depthMatch || !scoreMatch) {
      continue;
    }

    const depth = Number(depthMatch[1]);
    const pv = pvMatch ? Number(pvMatch[1]) : 1;
    const existing = byPv.get(pv);
    const existingDepth = existing
      ? Number(existing.match(/ depth (\d+)/)?.[1] ?? 0)
      : 0;

    if (!existing || existingDepth <= depth) {
      byPv.set(pv, line);
    }
  }

  return [...byPv.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, line]) => line);
}

function getPvFromLine(line: string): string[] {
  const idx = line.indexOf(" pv ");
  if (idx === -1) {
    return [];
  }
  return line.slice(idx + 4).trim().split(" ");
}

function parseBestMoveLine(lines: string[]): string {
  const bestLine = lines.find((line) => line.startsWith("bestmove"));
  const move = bestLine?.split(" ")[1] ?? "";
  if (!move || move === "(none)") {
    return "";
  }
  return move;
}

async function analyzePosition(
  fen: string,
  depth: number,
  skillLevel: number,
  multipv = 3,
): Promise<SearchResult> {
  try {
    await runCommands(
      [
        "stop",
        `setoption name Skill Level value ${skillLevel}`,
        `setoption name MultiPV value ${multipv}`,
        "isready",
      ],
      (line) => line === "readyok",
    );

    const lines = await runCommands(
      [`position fen ${fen}`, `go depth ${depth}`],
      (line) => line.startsWith("bestmove"),
    );

    const infoLines = extractBestInfoLines(
      lines.filter((line) => line.startsWith("info")),
    );
    const primary = infoLines[0] ?? "";
    const evalScore = primary ? parseScore(primary) : 0;
    const pv = getPvFromLine(primary);
    const bestMove = parseBestMoveLine(lines) || pv[0] || "";

    const alternatives = infoLines
      .map((line) => getPvFromLine(line)[0])
      .filter(Boolean)
      .filter((move, index, array) => array.indexOf(move) === index);

    if (!bestMove) {
      return fallbackAnalysis(fen, skillLevel);
    }

    return { evalScore, bestMove, alternatives, pv };
  } catch {
    return fallbackAnalysis(fen, skillLevel);
  }
}

export async function analyzeServerPosition(
  fen: string,
  skillLevel: number,
  depth = 8,
) {
  return analyzePosition(fen, depth, skillLevel, 2);
}

export async function getServerBestMove(
  fen: string,
  skillLevel: number,
  depth = 8,
): Promise<string> {
  try {
    await runCommands(
      [
        "stop",
        `setoption name Skill Level value ${skillLevel}`,
        "setoption name MultiPV value 1",
        "isready",
      ],
      (line) => line === "readyok",
    );

    const lines = await runCommands(
      [`position fen ${fen}`, `go depth ${depth}`],
      (line) => line.startsWith("bestmove"),
      25000,
    );

    const bestMove = parseBestMoveLine(lines);
    if (bestMove) {
      return bestMove;
    }
  } catch {
    recoverEngine();
  }

  return fallbackBestMove(fen, skillLevel);
}

export async function analyzeServerMove(
  fenBefore: string,
  fenAfter: string,
  playedMoveUci: string,
  skillLevel: number,
  depth = 8,
): Promise<MoveAnalysis> {
  const before = await analyzePosition(fenBefore, depth, skillLevel, 2);
  const after = await analyzePosition(fenAfter, depth, skillLevel, 1);

  const evalBefore = evalFromWhitePerspective(fenBefore, before.evalScore);
  const evalAfter = evalFromWhitePerspective(fenAfter, after.evalScore);
  const isWhiteMove = fenBefore.split(" ")[1] === "w";
  const centipawnLoss = isWhiteMove
    ? Math.max(0, evalBefore - evalAfter)
    : Math.max(0, evalAfter - evalBefore);

  return {
    evalBefore,
    evalAfter,
    centipawnLoss,
    classification: classifyMove(centipawnLoss, playedMoveUci, before.bestMove),
    bestMove: before.bestMove,
    playedMove: playedMoveUci,
    alternatives: before.alternatives.filter((move) => move !== playedMoveUci),
    pv: after.pv.slice(0, 5),
  };
}
