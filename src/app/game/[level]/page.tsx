import { notFound } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { GameBoard } from "@/components/game/GameBoard";
import { isValidLevel } from "@/lib/chess/difficulty";

interface GamePageProps {
  params: Promise<{ level: string }>;
}

export default async function GamePage({ params }: GamePageProps) {
  const { level } = await params;

  if (!isValidLevel(level)) {
    notFound();
  }

  return (
    <MobileShell>
      <Header variant="game" />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <GameBoard level={level} />
      </main>
      <BottomNav />
    </MobileShell>
  );
}
