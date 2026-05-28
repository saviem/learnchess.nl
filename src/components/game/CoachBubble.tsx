"use client";

import Image from "next/image";
import {
  BarChart3,
  FastForward,
  Lightbulb,
  Loader2,
} from "lucide-react";
import type { CoachResponse } from "@/lib/coach/types";

type BubblePanel = "main" | "variant" | "blunder" | "next";
type BubbleMode = "feedback" | "hint";

interface CoachBubbleProps {
  loading: boolean;
  response: CoachResponse | null;
  activePanel: BubblePanel;
  onPanelChange: (panel: BubblePanel) => void;
  onNewGame?: () => void;
  showNewGame?: boolean;
  mode?: BubbleMode;
  hintPlan?: string;
}

function renderMarkdown(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

export function CoachBubble({
  loading,
  response,
  activePanel,
  onPanelChange,
  onNewGame,
  showNewGame,
  mode = "feedback",
  hintPlan,
}: CoachBubbleProps) {
  const panelContent = (() => {
    if (!response) {
      return "Maak je eerste zet — ik geef je direct feedback!";
    }

    switch (activePanel) {
      case "variant":
        return response.variantLine
          ? `Alternatieve variant: ${response.variantLine}`
          : "Geen alternatieve variant beschikbaar voor deze positie.";
      case "blunder":
        return (
          response.blunderAnalysis ??
          "Geen duidelijke fout gevonden — goed gespeeld!"
        );
      case "next":
        if (mode === "hint" && response?.followUpSteps.length) {
          return response.followUpSteps
            .map((step, i) => `${i + 1}. ${step}`)
            .join("\n");
        }
        return response.followUpSteps.length
          ? response.followUpSteps.map((step, i) => `${i + 1}. ${step}`).join("\n")
          : "Geen vervolgstappen beschikbaar.";
      default:
        return response.summary;
    }
  })();

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

        {mode === "hint" && !loading && (
          <span className="mb-2 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
            Tip voor je zet
          </span>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            {mode === "hint" ? "Tip voorbereiden..." : "Coach denkt na..."}
          </div>
        ) : (
          <>
            <p
              className="coach-text whitespace-pre-line text-sm leading-relaxed text-slate-100"
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(panelContent),
              }}
            />
            {mode === "hint" && hintPlan && activePanel === "main" && (
              <p className="mt-2 text-xs text-slate-300">{hintPlan}</p>
            )}
          </>
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

        <div className="mt-4 flex flex-wrap gap-2">
          {mode === "feedback" && (
            <>
              <BubbleButton
                icon={<Lightbulb className="h-3.5 w-3.5" />}
                label="Toon Variant"
                active={activePanel === "variant"}
                onClick={() => onPanelChange(activePanel === "variant" ? "main" : "variant")}
                disabled={loading || !response}
              />
              <BubbleButton
                icon={<BarChart3 className="h-3.5 w-3.5" />}
                label="Analyseer Fout"
                active={activePanel === "blunder"}
                onClick={() => onPanelChange(activePanel === "blunder" ? "main" : "blunder")}
                disabled={loading || !response}
              />
            </>
          )}
          <BubbleButton
            icon={<FastForward className="h-3.5 w-3.5" />}
            label={mode === "hint" ? "Suggesties" : "Volgende Stap"}
            active={activePanel === "next"}
            onClick={() => onPanelChange(activePanel === "next" ? "main" : "next")}
            disabled={loading || !response}
          />
        </div>
      </div>
    </div>
  );
}

function BubbleButton({
  icon,
  label,
  active,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-40 ${
        active
          ? "bg-white text-navy"
          : "bg-slate-600/80 text-slate-100 hover:bg-slate-500"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
