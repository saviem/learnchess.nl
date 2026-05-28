import {
  classificationLabel,
  formatEval,
} from "@/lib/chess/analysis";
import { uciToSan } from "@/lib/chess/captures";
import {
  formatSuggestionLine,
  reasonForMovePlain,
} from "@/lib/chess/move-language";
import type {
  CoachRequest,
  CoachResponse,
  HintRequest,
  HintResponse,
  HintSuggestion,
} from "@/lib/coach/types";

export function buildCoachSystemPrompt(level: string, coachTone: string): string {
  return `Je bent een vriendelijke Nederlandse schaakcoach van learnchess.nl.
Spreek de speler direct aan. Gebruik ${coachTone}.
Niveau van de speler: ${level}.
Geef korte, leerzame feedback na elke zet.
Noem velden in SAN-notatie en vet belangrijke velden met **vet** markdown (bijv. **f3**).
Antwoord ALLEEN met geldig JSON volgens het gevraagde schema.`;
}

export function buildCoachUserPrompt(request: CoachRequest): string {
  const { analysis, moveSan, fen, isGameOver, gameResult } = request;

  return JSON.stringify(
    {
      fen,
      move: moveSan,
      classification: analysis.classification,
      evalBefore: formatEval(analysis.evalBefore),
      evalAfter: formatEval(analysis.evalAfter),
      centipawnLoss: analysis.centipawnLoss,
      bestMove: analysis.bestMove,
      alternatives: analysis.alternatives,
      principalVariation: analysis.pv,
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
  const { analysis, moveSan } = request;
  const label = classificationLabel(analysis.classification);

  if (request.isGameOver) {
    return {
      summary: `De partij is afgelopen: ${request.gameResult ?? "einde partij"}. Goed gespeeld! Start een nieuw spel om verder te oefenen.`,
      verdict: "neutral",
      followUpSteps: ["Analyseer je opening", "Probeer een hoger niveau", "Herhaad kritieke posities"],
      source: "fallback",
    };
  }

  const evalChange =
    analysis.evalAfter >= analysis.evalBefore
      ? "Je positie is verbeterd of gelijk gebleven."
      : `Je verliest ongeveer ${Math.round(analysis.centipawnLoss / 10) / 10} pion aan evaluatie.`;

  const bestHint =
    analysis.bestMove !== analysis.playedMove
      ? `Sterker was ${analysis.bestMove.toUpperCase()}.`
      : "Dit was de beste zet volgens de engine.";

  const followUpSteps =
    analysis.pv.length > 0
      ? analysis.pv.slice(0, 3).map((move) => `Overweeg ${move.toUpperCase()}`)
      : ["Houd het centrum onder controle", "Ontwikkel je stukken", "Let op tactische dreigingen"];

  let summary = `**${label}!** Je speelde **${moveSan}**. ${evalChange} ${bestHint}`;

  if (analysis.classification === "blunder" || analysis.classification === "mistake") {
    summary += ` Overweeg **${analysis.alternatives[0]?.toUpperCase() ?? analysis.bestMove.toUpperCase()}** als alternatief.`;
  }

  return {
    summary,
    verdict: analysis.classification,
    followUpSteps,
    variantLine:
      analysis.alternatives.length > 0
        ? `${analysis.alternatives[0]} ${analysis.pv.slice(1, 3).join(" ")}`.trim()
        : analysis.pv.join(" "),
    blunderAnalysis:
      analysis.classification === "mistake" || analysis.classification === "blunder"
        ? `Deze zet kostte ${analysis.centipawnLoss} centipawns ten opzichte van het beste plan.`
        : undefined,
    source: "fallback",
  };
}

export function buildHintSystemPrompt(level: string, coachTone: string): string {
  return `Je bent een vriendelijke Nederlandse schaakcoach van learnchess.nl.
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
      "Kijk naar het midden van het bord en of je koning veilig staat. Welke stukken moet je nog in het spel zetten? Open **Suggesties** om te zien welk stuk je waarheen kunt zetten.",
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
