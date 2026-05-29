"use client";

import { useEffect, useState } from "react";
import { BarChart3, Lightbulb, Loader2 } from "lucide-react";
import type { CoachResponse } from "@/lib/coach/types";

type CoachPhase = "suggest" | "review" | "bot";

interface CoachBubbleProps {
  loading: boolean;
  loadingText?: string;
  phase: CoachPhase;
  response: CoachResponse | null;
  moveMade?: boolean;
  onNewGame?: () => void;
  showNewGame?: boolean;
}

function renderMarkdown(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

export function CoachBubble({
  loading,
  loadingText: loadingTextOverride,
  phase,
  response,
  moveMade,
  onNewGame,
  showNewGame,
}: CoachBubbleProps) {
  const [showVariant, setShowVariant] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  useEffect(() => {
    setShowVariant(false);
    setShowAnalysis(false);
  }, [response?.summary, response?.variantLine, response?.blunderAnalysis, phase]);

  const badge = (() => {
    if (phase === "suggest") {
      return moveMade ? "Klaar met zetten?" : "Kies een zet";
    }
    if (phase === "review") {
      return "Feedback op je zet";
    }
    return "Computer denkt na";
  })();

  const content = (() => {
    if (!response) {
      return loading
        ? "Tip voorbereiden..."
        : "Kies een zet op het bord om te beginnen.";
    }

    if (phase === "suggest") {
      const lines = [response.summary];

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

    return response.summary;
  })();

  const loadingText =
    loadingTextOverride ??
    (phase === "suggest"
      ? "Tip voorbereiden..."
      : phase === "review"
        ? "Coach bekijkt je zet..."
        : "Computer zet...");

  return (
    <div className="px-4 pb-4">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        {!loading && (
          <span className="mb-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            {badge}
          </span>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText}
          </div>
        ) : (
          <p
            className="coach-text whitespace-pre-line text-sm leading-relaxed text-slate-700"
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
              <InfoChip
                icon={<Lightbulb className="h-3.5 w-3.5" />}
                label="Variant"
                active={showVariant}
                onClick={() => setShowVariant((open) => !open)}
              />
            )}
            {response.blunderAnalysis && (
              <InfoChip
                icon={<BarChart3 className="h-3.5 w-3.5" />}
                label="Analyse"
                active={showAnalysis}
                onClick={() => setShowAnalysis((open) => !open)}
              />
            )}
          </div>
        )}

        {phase === "review" && !loading && showVariant && response?.variantLine && (
          <p className="mt-2 text-xs text-muted">
            Variant: {response.variantLine}
          </p>
        )}

        {phase === "review" && !loading && showAnalysis && response?.blunderAnalysis && (
          <p className="mt-2 text-xs text-muted">{response.blunderAnalysis}</p>
        )}
      </div>
    </div>
  );
}

function InfoChip({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
        active
          ? "border-amber-300 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
