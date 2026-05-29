"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, X } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

interface HeaderProps {
  variant?: "landing" | "game";
}

export function Header({ variant = "landing" }: HeaderProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  if (variant === "game") {
    return (
      <>
        <header className="border-b border-slate-100 bg-white text-navy">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-6">
            <Link href="/" className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              <span className="text-lg font-bold">{APP_NAME}</span>
            </Link>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="text-xs font-semibold tracking-wider opacity-90 hover:opacity-100"
            >
              HELP
            </button>
          </div>
        </header>

        {helpOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-navy">Hoe werkt het?</h2>
                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  aria-label="Sluiten"
                >
                  <X className="h-5 w-5 text-muted" />
                </button>
              </div>
              <ul className="space-y-2 text-sm text-muted">
                <li>• Je speelt als wit tegen de AI.</li>
                <li>• Sleep stukken om te zetten.</li>
                <li>• Na elke zet krijg je feedback in de bubble.</li>
                <li>• Gebruik de knoppen voor varianten, foutanalyse en vervolgstappen.</li>
              </ul>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-7xl items-center px-5 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          <span className="text-lg font-bold">{APP_NAME}</span>
        </Link>
      </div>
    </header>
  );
}
