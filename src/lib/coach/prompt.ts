import {
  classificationLabel,
  formatEval,
  isSameUciMove,
} from "@/lib/chess/analysis";
import { uciToSan } from "@/lib/chess/captures";
import {
  buildOpponentMoveSummary,
  formatSuggestionLine,
  playedMoveMatchesSuggestion,
  reasonForMovePlain,
} from "@/lib/chess/move-language";
import { APP_NAME } from "@/lib/constants";
import type {
  CoachRequest,
  CoachResponse,
  HintRequest,
  HintResponse,
  HintSuggestion,
  OpponentMoveRequest,
} from "@/lib/coach/types";

export function buildCoachSystemPrompt(level: string, coachTone: string): string {
  return `Je bent een vriendelijke Nederlandse schaakcoach van ${APP_NAME}.
Spreek de speler direct aan. Gebruik ${coachTone}.
Niveau van de speler: ${level}.
Schrijf in Jip-en-Janneke-taal: korte zinnen, geen moeilijke termen.
Geef eerlijke maar aanmoedigende feedback na elke zet.
Als followedSuggestion true is, speelde de speler een zet die wij net hadden voorgesteld — prijs dat altijd positief, nooit "fout" of "blunder".
Noem zetten in SAN (bijv. **e4**, **Nf3**), nooit in UCI (niet g1f3).
Wees niet te streng bij kleine verschillen of populaire openingzetten.
Antwoord ALLEEN met geldig JSON volgens het gevraagde schema.`;
}

function uciMovesToSan(fen: string, moves: string[]): string[] {
  return moves
    .map((move) => uciToSan(fen, move))
    .filter((move): move is string => Boolean(move));
}

export function buildCoachUserPrompt(request: CoachRequest): string {
  const { analysis, moveSan, fen, fenBefore, isGameOver, gameResult } = request;
  const bestMoveSan = uciToSan(fenBefore, analysis.bestMove);
  const alternativeSans = uciMovesToSan(fenBefore, analysis.alternatives);

  return JSON.stringify(
    {
      fen,
      move: moveSan,
      followedSuggestion: Boolean(request.followedSuggestion),
      suggestedMoves: request.suggestedMoves ?? [],
      classification: analysis.classification,
      evalBefore: formatEval(analysis.evalBefore),
      evalAfter: formatEval(analysis.evalAfter),
      centipawnLoss: analysis.centipawnLoss,
      bestMove: bestMoveSan ?? analysis.bestMove,
      alternatives: alternativeSans,
      principalVariation: uciMovesToSan(fenBefore, analysis.pv),
      isGameOver: Boolean(isGameOver),
      gameResult: gameResult ?? null,
      responseSchema: {
        summary:
          "Hoofdtekst voor speech bubble, 2-4 zinnen, markdown toegestaan voor velden",
        verdict: "excellent|good|inaccuracy|mistake|blunder|neutral",
        followUpSteps: ["array van 2-3 korte vervolgstappen"],
        variantLine: "optionele alternatieve variant in SAN",
        blunderAnalysis: "optioneel, alleen bij fouten",
      },
    },
    null,
    2,
  );
}

export function buildFallbackCoachResponse(
  request: CoachRequest,
): CoachResponse {
  const { analysis, moveSan, fenBefore } = request;

  if (request.isGameOver) {
    return {
      summary: `De partij is afgelopen: ${request.gameResult ?? "einde partij"}. Goed gespeeld! Start een nieuw spel om verder te oefenen.`,
      verdict: "neutral",
      followUpSteps: ["Probeer een nieuwe opening", "Speel nog een partij", "Bekijk wat je leerde"],
      source: "fallback",
    };
  }

  if (request.followedSuggestion) {
    return {
      summary: `**Goed gedaan!** Je speelde **${moveSan}** — precies zoals we voorstelden. Dat is een logische zet. Ga zo door.`,
      verdict: "excellent",
      followUpSteps: [
        "Kijk wat de bot nu doet",
        "Zet je volgende stuk ook in het spel",
      ],
      source: "fallback",
    };
  }

  const label = classificationLabel(analysis.classification);
  const bestSan = uciToSan(fenBefore, analysis.bestMove);
  const altSan = uciToSan(fenBefore, analysis.alternatives[0] ?? "");

  const isPositive =
    analysis.classification === "excellent" ||
    analysis.classification === "good";

  const evalChange = isPositive
    ? "Dat is een logische zet in deze positie."
    : analysis.centipawnLoss <= 60
      ? "Het verschil met de beste zet is klein — geen zorgen."
      : "Er was een iets sterkere zet mogelijk.";

  const bestHint =
    bestSan && !isSameUciMove(analysis.playedMove, analysis.bestMove)
      ? `De computer zag **${bestSan}** als nét iets sterker.`
      : "Dit past bij wat de computer verwacht.";

  let summary = `**${label}!** Je speelde **${moveSan}**. ${evalChange}`;

  if (!isPositive && bestSan) {
    summary += ` ${bestHint}`;
  } else if (isPositive) {
    summary += " Ga zo door.";
  }

  const followUpSteps =
    analysis.classification === "mistake" || analysis.classification === "blunder"
      ? altSan
        ? [`Kijk of **${altSan}** beter past`, "Controleer of je koning veilig staat"]
        : ["Kijk nog eens naar je koning", "Controleer of je stukken veilig staan"]
      : ["Houd het midden van het bord in gedachten", "Zet je andere stukken ook in het spel"];

  return {
    summary,
    verdict: analysis.classification,
    followUpSteps,
    variantLine: altSan
      ? `${altSan} ${uciMovesToSan(fenBefore, analysis.pv.slice(1, 3)).join(" ")}`.trim()
      : uciMovesToSan(fenBefore, analysis.pv).join(" "),
    blunderAnalysis:
      analysis.classification === "mistake" || analysis.classification === "blunder"
        ? "Probeer te begrijpen waarom deze zet minder sterk was voordat je verder zet."
        : undefined,
    source: "fallback",
  };
}

export function prepareCoachRequest(body: CoachRequest): CoachRequest {
  const suggestedMoves = body.suggestedMoves ?? [];
  const followedSuggestion =
    body.followedSuggestion ??
    playedMoveMatchesSuggestion(
      body.fenBefore,
      body.analysis.playedMove,
      suggestedMoves,
    );

  if (!followedSuggestion) {
    return { ...body, suggestedMoves, followedSuggestion: false };
  }

  return {
    ...body,
    suggestedMoves,
    followedSuggestion: true,
    analysis: {
      ...body.analysis,
      classification: "excellent",
      centipawnLoss: 0,
    },
  };
}

export function buildOpponentMoveSystemPrompt(
  level: string,
  coachTone: string,
): string {
  return `Je bent een vriendelijke Nederlandse schaakcoach van ${APP_NAME}.
Leg uit wat de TEGENSTANDER (de bot, zwart) net heeft gedaan. Gebruik ${coachTone}.
Niveau: ${level}.
Schrijf in Jip-en-Janneke-taal voor een beginner.
Beschrijf eerst WELKE zet de bot deed, daarna WAAROM dat logisch kan zijn of waar de speler op moet letten.
Noem zetten in SAN (bijv. **e5**, **Nf6**).
Antwoord ALLEEN met geldig JSON: { "summary": "...", "followUpSteps": ["..."] }`;
}

export function buildOpponentMoveUserPrompt(request: OpponentMoveRequest): string {
  return JSON.stringify(
    {
      fenBefore: request.fenBefore,
      fenAfter: request.fen,
      botMove: request.moveSan,
      isCheck: Boolean(request.isCheck),
      isCapture: Boolean(request.isCapture),
      responseSchema: {
        summary: "2-3 zinnen: wat deed de bot en waar moet wit op letten",
        followUpSteps: ["1-2 korte tips voor de volgende zet van wit"],
      },
    },
    null,
    2,
  );
}

export function buildFallbackOpponentMoveResponse(
  request: OpponentMoveRequest,
): CoachResponse {
  const summary = buildOpponentMoveSummary(request.fenBefore, request.moveSan);

  const followUpSteps = request.isCheck
    ? ["Bescherm je koning", "Kijk welke zet de schaak wegneemt"]
    : request.isCapture
      ? ["Kijk of je het geslagen stuk terug kunt winnen", "Controleer of je koning veilig staat"]
      : ["Kijk wat de bot dreigt", "Zet je eigen stukken verder in het spel"];

  return {
    summary,
    verdict: "neutral",
    followUpSteps,
    source: "fallback",
  };
}

export function buildHintSystemPrompt(level: string, coachTone: string): string {
  return `Je bent een vriendelijke Nederlandse schaakcoach van ${APP_NAME}.
Geef een proactieve tip VOORDAT de speler zet. Gebruik ${coachTone}.
Niveau: ${level}.
Schrijf in Jip-en-Janneke-taal: korte zinnen, geen moeilijke schaaktermen.
In "summary": leg uit wat de speler moet zoeken (midden van het bord, koning veilig, stukken in het spel). Noem GEEN zetten.
In "suggestions": geef 2-3 unieke zetten als SAN in "move", en in "reason" leg uit WAAROM in simpele taal.
Geen dubbele zetten. Geen herhaling tussen summary en suggestions.
Antwoord ALLEEN met geldig JSON.`;
}

function normalizeSan(san: string): string {
  return san.replace(/[+#!?]/g, "").trim().toLowerCase();
}

export function dedupeHintSuggestions(
  suggestions: HintSuggestion[],
): HintSuggestion[] {
  const seen = new Set<string>();
  const result: HintSuggestion[] = [];

  for (const suggestion of suggestions) {
    const move = suggestion.move?.trim();
    if (!move) {
      continue;
    }

    const key = normalizeSan(move);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({ move, reason: suggestion.reason?.trim() ?? "" });
  }

  return result;
}

export function reasonForMove(fen: string, san: string): string {
  return reasonForMovePlain(fen, san);
}

export function formatHintFollowUpSteps(
  fen: string,
  suggestions: HintSuggestion[],
): string[] {
  return suggestions.map((suggestion) =>
    formatSuggestionLine(fen, suggestion.move, suggestion.reason),
  );
}

export function buildHintUserPrompt(request: HintRequest): string {
  const bestSan = uciToSan(request.fen, request.analysis.bestMove);
  const altSans = request.analysis.alternatives
    .map((uci) => uciToSan(request.fen, uci))
    .filter(Boolean) as string[];

  const uniqueMoves = dedupeHintSuggestions(
    [bestSan, ...altSans]
      .filter((move): move is string => Boolean(move))
      .map((move) => ({ move, reason: "" })),
  ).slice(0, 3);

  return JSON.stringify(
    {
      fen: request.fen,
      engineMoves: uniqueMoves.map((suggestion) => suggestion.move),
      principalVariation: request.analysis.pv,
      eval: formatEval(request.analysis.evalScore),
      responseSchema: {
        summary:
          "Algemene tip over de positie (2-3 zinnen), zonder concrete zetten te noemen",
        suggestions: [
          {
            move: "SAN zet (uniek, alleen voor het systeem)",
            reason: "1 korte zin in Jip-en-Janneke-taal waarom dit slim is",
          },
        ],
        plan: "Korte strategische richtlijn in 1 zin",
      },
    },
    null,
    2,
  );
}

export function buildFallbackHintResponse(request: HintRequest): HintResponse {
  const bestSan = uciToSan(request.fen, request.analysis.bestMove);
  const altSans = request.analysis.alternatives
    .map((uci) => uciToSan(request.fen, uci))
    .filter(Boolean) as string[];

  const suggestions = dedupeHintSuggestions(
    [bestSan, ...altSans]
      .filter((move): move is string => Boolean(move))
      .map((move) => ({
        move,
        reason: reasonForMovePlain(request.fen, move),
      })),
  ).slice(0, 3);

  const fallbackSuggestions: HintSuggestion[] = suggestions.length
    ? suggestions
    : [
        { move: "e4", reason: reasonForMovePlain(request.fen, "e4") },
        { move: "Nf3", reason: reasonForMovePlain(request.fen, "Nf3") },
      ];

  return {
    summary:
      "Kijk naar het midden van het bord en of je koning veilig staat. Welke stukken moet je nog in het spel zetten?",
    suggestions: fallbackSuggestions,
    plan: "Zet je stukken in het spel, word sterker in het midden en zorg dat je koning veilig staat.",
    source: "fallback",
  };
}

export function normalizeHintResponse(
  fen: string,
  parsed: Partial<HintResponse> & { suggestedMoves?: string[] },
  fallback: HintResponse,
): HintResponse {
  const rawSuggestions: HintSuggestion[] = parsed.suggestions?.length
    ? parsed.suggestions
    : (parsed.suggestedMoves ?? []).map((move) => ({
        move,
        reason: "",
      }));

  const suggestions = dedupeHintSuggestions(
    rawSuggestions.length ? rawSuggestions : fallback.suggestions,
  )
    .slice(0, 3)
    .map((suggestion) => ({
      move: suggestion.move,
      reason:
        suggestion.reason && !suggestion.reason.includes("engine")
          ? suggestion.reason
          : reasonForMovePlain(fen, suggestion.move),
    }));

  return {
    summary: parsed.summary?.trim() || fallback.summary,
    suggestions,
    plan: parsed.plan?.trim() || fallback.plan,
    source: parsed.suggestions?.length ? "openai" : fallback.source,
  };
}
