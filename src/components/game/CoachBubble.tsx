"use client";

import Image from "next/image";
import { BarChart3, Lightbulb, Loader2 } from "lucide-react";
import type { CoachResponse } from "@/lib/coach/types";

type CoachPhase = "suggest" | "review" | "bot" | "opponent";

interface CoachBubbleProps {
  loading: boolean;
  phase: CoachPhase;
  response: CoachResponse | null;
  hintPlan?: string;
  moveMade?: boolean;
  showOpponentTips?: boolean;
  onNewGame?: () => void;
  showNewGame?: boolean;
}

function renderMarkdown(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

export function CoachBubble({
  loading,
  phase,
  response,
  hintPlan,
  moveMade,
  showOpponentTips,
  onNewGame,
  showNewGame,
}: CoachBubbleProps) {
  const badge = (() => {
    if (phase === "suggest") {
      return moveMade ? "Klaar met zetten?" : "Kies een zet";
    }
    if (phase === "review") {
      return "Feedback op je zet";
    }
    if (phase === "opponent") {
      return "Zet van de bot";
    }
    return "Computer denkt na";
  })();

  const content = (() => {
    if (!response) {
      return "Even geduld — ik bedenk een tip voor je...";
    }

    if (phase === "suggest") {
      const lines = [response.summary];

      if (hintPlan) {
        lines.push("", hintPlan);
      }

      if (response.followUpSteps.length > 0) {
        lines.push(
          "",
          "Suggesties:",
          ...response.followUpSteps.map((step, index) => `${index + 1}. ${step}`),
        );
      }

      if (moveMade) {
        lines.push("", "Klik op **Volgende** voor feedback op je zet.");
      }

      return lines.join("\n");
    }

    if (phase === "opponent") {
      const lines = [response.summary];

      if (response.followUpSteps.length > 0) {
        lines.push(
          "",
          "Let op:",
          ...response.followUpSteps.map((step, index) => `${index + 1}. ${step}`),
        );
      }

      if (showOpponentTips) {
        lines.push("", "Klik op **Volgende** om je eigen zet te plannen.");
      }

      return lines.join("\n");
    }

    return response.summary;
  })();

  const loadingText =
    phase === "suggest"
      ? "Tip voorbereiden..."
      : phase === "review"
        ? "Coach bekijkt je zet..."
        : phase === "opponent"
          ? "Bot-zet uitleggen..."
          : "Computer zet...";

  return (
    <div className="relative px-4 pb-4 pt-8">
      <div className="absolute left-8 top-0 z-10">
        <div className="overflow-hidden rounded-xl border-2 border-white bg-slate-100 shadow-md">
          <Image
            src="/bot-avatar.svg"
            alt="learnchess.nl coach"
            width={48}
            height={48}
            className="h-12 w-12"
          />
        </div>
      </div>

      <div className="relative rounded-2xl bg-bubble px-4 pb-3 pt-5 text-white shadow-lg">
        <div className="absolute -top-2 left-10 h-4 w-4 rotate-45 bg-bubble" />

        {!loading && (
          <span className="mb-2 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
            {badge}
          </span>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText}
          </div>
        ) : (
          <p
            className="coach-text whitespace-pre-line text-sm leading-relaxed text-slate-100"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(content),
            }}
          />
        )}

        {showNewGame && onNewGame && (
          <button
            type="button"
            onClick={onNewGame}
            className="mt-3 w-full rounded-xl bg-gold px-4 py-2 text-sm font-bold text-navy transition hover:bg-yellow-400"
          >
            Nieuw spel
          </button>
        )}

        {phase === "review" && !loading && response && (
          <div className="mt-4 flex flex-wrap gap-2">
            {response.variantLine && (
              <InfoChip icon={<Lightbulb className="h-3.5 w-3.5" />} label="Variant" />
            )}
            {response.blunderAnalysis && (
              <InfoChip icon={<BarChart3 className="h-3.5 w-3.5" />} label="Analyse" />
            )}
          </div>
        )}

        {phase === "review" && !loading && response?.variantLine && (
          <p className="mt-2 text-xs text-slate-300">
            Variant: {response.variantLine}
          </p>
        )}

        {phase === "review" && !loading && response?.blunderAnalysis && (
          <p className="mt-2 text-xs text-slate-300">{response.blunderAnalysis}</p>
        )}
      </div>
    </div>
  );
}

function InfoChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-600/80 px-3 py-1.5 text-[11px] font-semibold text-slate-100">
      {icon}
      {label}
    </span>
  );
}
