import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Construction } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <MobileShell>
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 rounded-2xl bg-slate-100 p-4">
          <Construction className="h-8 w-8 text-navy" />
        </div>
        <h1 className="text-2xl font-bold text-navy">{title}</h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
          {description}
        </p>
        <span className="mt-6 rounded-full bg-gold/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
          Binnenkort
        </span>
      </main>
      <BottomNav />
    </MobileShell>
  );
}
