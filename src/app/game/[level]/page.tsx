import { notFound } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
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
    <MobileShell className="bg-white">
      <Header variant="game" />
      <main className="flex flex-1 flex-col overflow-y-auto bg-white">
        <GameBoard level={level} />
      </main>
    </MobileShell>
  );
}
