import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";

export default function NotFound() {
  return (
    <MobileShell>
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-navy">Pagina niet gevonden</h1>
        <p className="mt-3 text-sm text-muted">
          Deze pagina bestaat niet. Kies een niveau om te spelen.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white"
        >
          Terug naar home
        </Link>
      </main>
      <BottomNav />
    </MobileShell>
  );
}
