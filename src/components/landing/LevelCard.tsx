import Link from "next/link";
import { ChevronRight, Crown, Shield, Zap } from "lucide-react";
import type { DifficultyConfig } from "@/lib/chess/difficulty";

const ICONS = {
  pawn: Shield,
  knight: Zap,
  king: Crown,
};

interface LevelCardProps {
  level: DifficultyConfig;
}

export function LevelCard({ level }: LevelCardProps) {
  const Icon = ICONS[level.icon];

  return (
    <Link
      href={`/game/${level.id}`}
      className={`group relative block rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        level.featured
          ? "border-2 border-gold ring-1 ring-gold/20"
          : "border border-slate-100"
      }`}
    >
      {level.featured && (
        <span className="absolute -top-px right-4 rounded-b-lg bg-gold px-3 py-1 text-[10px] font-bold tracking-wide text-navy">
          POPULAIRST
        </span>
      )}

      <div className="flex items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
            level.featured ? "bg-gold/20" : "bg-slate-100"
          }`}
        >
          <Icon className="h-7 w-7 text-navy" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-navy">{level.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {level.description}
          </p>
          <span
            className={`mt-3 inline-flex items-center gap-1 text-xs font-bold tracking-wide ${
              level.featured ? "text-gold" : "text-navy"
            }`}
          >
            {level.cta}
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
