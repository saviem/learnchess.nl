import { createRequire } from "node:module";
import { classifyMove, parseScore } from "@/lib/chess/analysis";
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
let commandChain: Promise<unknown> = Promise.resolve();

function normalizeLine(message: string): string {
  return message.trim();
}

function getEngine(): Promise<StockfishProcess> {
  if (engineReady) {
    return engineReady;
  }

  engineReady = new Promise<StockfishProcess>((resolve, reject) => {
    let settled = false;

    initEngine("lite-single", (error, engine) => {
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
  }).catch((error) => {
    engineReady = null;
    throw error;
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
): Promise<string[]> {
  return enqueue(async () => {
    const engine = await getEngine();
    const lines: string[] = [];

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Stockfish analyse timeout."));
      }, 30000);

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

async function analyzePosition(
  fen: string,
  depth: number,
  skillLevel: number,
  multipv = 3,
): Promise<SearchResult> {
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

  const infoLines = extractBestInfoLines(lines.filter((line) => line.startsWith("info")));
  const primary = infoLines[0] ?? "";
  const evalScore = primary ? parseScore(primary) : 0;
  const pv = getPvFromLine(primary);
  const bestMove = pv[0] ?? "";

  const alternatives = infoLines
    .map((line) => getPvFromLine(line)[0])
    .filter(Boolean)
    .filter((move, index, array) => array.indexOf(move) === index);

  return { evalScore, bestMove, alternatives, pv };
}

export async function analyzeServerPosition(
  fen: string,
  skillLevel: number,
  depth = 12,
) {
  return analyzePosition(fen, depth, skillLevel, 3);
}

export async function getServerBestMove(
  fen: string,
  skillLevel: number,
  depth = 12,
): Promise<string> {
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
  );

  const bestLine = lines.find((line) => line.startsWith("bestmove"));
  return bestLine?.split(" ")[1] ?? "";
}

export async function analyzeServerMove(
  fenBefore: string,
  fenAfter: string,
  playedMoveUci: string,
  skillLevel: number,
  depth = 13,
): Promise<MoveAnalysis> {
  const before = await analyzePosition(fenBefore, depth, skillLevel, 3);
  const after = await analyzePosition(fenAfter, depth, skillLevel, 1);

  const isWhiteToMove = fenBefore.split(" ")[1] === "w";
  const centipawnLoss = isWhiteToMove
    ? before.evalScore - after.evalScore
    : after.evalScore - before.evalScore;

  return {
    evalBefore: before.evalScore,
    evalAfter: after.evalScore,
    centipawnLoss: Math.max(0, centipawnLoss),
    classification: classifyMove(
      Math.max(0, centipawnLoss),
      playedMoveUci,
      before.bestMove,
    ),
    bestMove: before.bestMove,
    playedMove: playedMoveUci,
    alternatives: before.alternatives.filter((move) => move !== playedMoveUci),
    pv: after.pv.slice(0, 5),
  };
}
