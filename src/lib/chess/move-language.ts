import { Chess, type PieceSymbol } from "chess.js";

const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: "pion",
  n: "paard",
  b: "loper",
  r: "toren",
  q: "dame",
  k: "koning",
};

const PIECE_DEFINITE_ARTICLE: Record<PieceSymbol, "de" | "het"> = {
  p: "de",
  n: "het",
  b: "de",
  r: "de",
  q: "de",
  k: "de",
};

function pieceLabel(type: PieceSymbol): string {
  return PIECE_NAMES[type];
}

function pieceWithDefiniteArticle(type: PieceSymbol): string {
  return `${PIECE_DEFINITE_ARTICLE[type]} ${pieceLabel(type)}`;
}

function squareLabel(square: string): string {
  return square.toLowerCase();
}

function normalizeSan(san: string): string {
  return san.replace(/[+#!?]/g, "").trim();
}

export function playedMoveMatchesSuggestion(
  fenBefore: string,
  playedMoveUci: string,
  suggestedMoves: string[],
): boolean {
  const target = playedMoveUci.trim().toLowerCase();

  for (const suggested of suggestedMoves) {
    const cleaned = normalizeSan(suggested);
    if (!cleaned) {
      continue;
    }

    try {
      const chess = new Chess(fenBefore);
      const move = chess.move(cleaned);
      if (!move) {
        continue;
      }

      const uci = `${move.from}${move.to}${move.promotion ?? ""}`.toLowerCase();
      if (uci === target) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

export function describeOpponentMovePlain(fenBefore: string, san: string): string {
  try {
    const chess = new Chess(fenBefore);
    const move = chess.move(san.replace(/[+#!?]/g, ""));

    if (!move) {
      return `De bot speelde **${san}**.`;
    }

    if (move.flags.includes("k")) {
      return "De bot rokeert kort: zijn koning gaat naar g8 en zijn toren naar f8.";
    }

    if (move.flags.includes("q")) {
      return "De bot rokeert lang: zijn koning gaat naar c8 en zijn toren naar d8.";
    }

    const piece = pieceLabel(move.piece);
    const from = squareLabel(move.from);
    const to = squareLabel(move.to);

    if (move.captured) {
      const captured = pieceLabel(move.captured);
      return `De bot zet zijn ${piece} van ${from} naar ${to} en slaat jouw ${captured}.`;
    }

    if (move.flags.includes("e")) {
      return `De bot slaat met een pion van ${from} naar ${to} (passant).`;
    }

    if (move.promotion) {
      const promoted = pieceLabel(move.promotion);
      return `De bot zet een pion van ${from} naar ${to} en maakt er een ${promoted} van.`;
    }

    let text = `De bot zet zijn ${piece} van ${from} naar ${to}`;

    if (move.san.includes("#")) {
      text += " — schaakmat";
    } else if (move.san.includes("+")) {
      text += " en geeft schaak";
    }

    return `${text}.`;
  } catch {
    return `De bot speelde **${san}**.`;
  }
}

export function reasonForOpponentMove(fenBefore: string, san: string): string {
  try {
    const chess = new Chess(fenBefore);
    const move = chess.move(san.replace(/[+#!?]/g, ""));

    if (!move) {
      return "Kijk goed wat er veranderd is op het bord.";
    }

    if (move.san.includes("#")) {
      return "Je koning staat te dicht bij gevaar — dit is het einde van de partij.";
    }

    if (move.san.includes("+")) {
      return "Let op: je koning staat onder druk. Denk eerst aan veiligheid.";
    }

    if (move.flags.includes("k") || move.flags.includes("q")) {
      return "Daarmee zet de bot zijn koning op een veiligere plek.";
    }

    if (move.captured) {
      return "De bot wint materiaal — kijk of je stuk echt verdedigd moet worden.";
    }

    switch (move.piece) {
      case "p":
        if (["4", "5"].includes(move.to[1])) {
          return "Daarmee neemt de bot ruimte in het midden van het bord.";
        }
        return "De bot bereidt een volgende zet voor.";
      case "n":
        return "De bot zet een paard in het spel.";
      case "b":
        return "De bot activeert een loper.";
      case "r":
        return "De bot zet een toren op een actievere plek.";
      case "q":
        return "De bot brengt zijn dame in het spel — let extra op.";
      case "k":
        return "De bot verplaatst zijn koning.";
      default:
        return "Kijk wat de bot daarmee dreigt te doen.";
    }
  } catch {
    return "Kijk goed wat er veranderd is op het bord.";
  }
}

export function buildOpponentMoveSummary(fenBefore: string, moveSan: string): string {
  const action = describeOpponentMovePlain(fenBefore, moveSan);
  const reason = reasonForOpponentMove(fenBefore, moveSan);
  return `${action} ${reason}`;
}

export function describeMovePlain(fen: string, san: string): string | null {
  try {
    const chess = new Chess(fen);
    const move = chess.move(san.replace(/[+#!?]/g, ""));

    if (!move) {
      return null;
    }

    if (move.flags.includes("k")) {
      return move.color === "w"
        ? "Rokeer kort: zet je koning naar g1 en je toren naar f1"
        : "Rokeer kort: zet je koning naar g8 en je toren naar f8";
    }

    if (move.flags.includes("q")) {
      return move.color === "w"
        ? "Rokeer lang: zet je koning naar c1 en je toren naar d1"
        : "Rokeer lang: zet je koning naar c8 en je toren naar d8";
    }

    const piece = pieceLabel(move.piece);
    const from = squareLabel(move.from);
    const to = squareLabel(move.to);

    if (move.captured) {
      const captured = pieceWithDefiniteArticle(move.captured);
      return `Zet je ${piece} van ${from} naar ${to} en sla ${captured} van de bot`;
    }

    if (move.flags.includes("e")) {
      return `Sla met je pion van ${from} naar ${to} (passant)`;
    }

    if (move.promotion) {
      const promoted = pieceLabel(move.promotion);
      return `Zet je pion van ${from} naar ${to} en maak er een ${promoted} van`;
    }

    return `Zet je ${piece} van ${from} naar ${to}`;
  } catch {
    return null;
  }
}

export function reasonForMovePlain(fen: string, san: string): string {
  try {
    const chess = new Chess(fen);
    const move = chess.move(san.replace(/[+#!?]/g, ""));

    if (!move) {
      return "De computer vindt dit een goede zet.";
    }

    if (move.flags.includes("k") || move.flags.includes("q")) {
      return "Zo staat je koning veiliger en kun je met beide torens gaan spelen.";
    }

    if (move.captured) {
      return "Zo win je een stuk van de bot en word je sterker.";
    }

    switch (move.piece) {
      case "p":
        if (["4", "5"].includes(move.to[1])) {
          return "Zo word je sterker in het midden van het bord.";
        }
        return "Zo bereid je een volgende zet voor.";
      case "n":
        return "Zo komt je paard in het spel en kun je later je koning veiliger zetten.";
      case "b":
        return "Zo komt je loper in het spel en kun je verder schaken.";
      case "r":
        return "Zo komt je toren op een betere plek te staan.";
      case "q":
        return "Zo komt je dame actiever in het spel.";
      case "k":
        return "Zo zet je je koning op een veiligere plek.";
      default:
        return "De computer vindt dit een goede zet.";
    }
  } catch {
    return "De computer vindt dit een goede zet.";
  }
}

export function formatSuggestionLine(
  fen: string,
  move: string,
  reason?: string,
): string {
  const action =
    describeMovePlain(fen, move) ?? `Doe de zet ${move.replace(/[+#!?]/g, "")}`;
  const simplified = reason?.trim() ? simplifyReasonText(reason) : "";
  const why = simplified || reasonForMovePlain(fen, move);

  return `**${action}** — ${why}`;
}

function simplifyReasonText(text: string): string {
  return text
    .replace(/\bcentrum\b/gi, "midden van het bord")
    .replace(/\bontwikkel\w*/gi, "in het spel zet")
    .replace(/\bengine\b/gi, "computer")
    .replace(/\bopties open\b/gi, "keuze houden")
    .replace(/\bnatuurlijk veld\b/gi, "goede plek")
    .replace(/\blichte stukken\b/gi, "paarden en lopers")
    .replace(/\bsterkste plannen\b/gi, "beste zetten")
    .replace(/\bvolgens de engine\b/gi, "volgens de computer")
    .trim();
}
