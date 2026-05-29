import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { HeroSection } from "@/components/landing/HeroSection";
import { LevelCard } from "@/components/landing/LevelCard";
import { CoachingSection } from "@/components/landing/CoachingSection";
import { DIFFICULTY_LEVELS } from "@/lib/chess/difficulty";

export default function HomePage() {
  return (
    <MobileShell>
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl">
          <HeroSection />
          <div className="grid gap-4 px-5 pb-6 sm:grid-cols-2 lg:grid-cols-3 lg:px-8">
            {DIFFICULTY_LEVELS.map((level) => (
              <LevelCard key={level.id} level={level} />
            ))}
          </div>
          <CoachingSection />
        </div>
      </main>
    </MobileShell>
  );
}
