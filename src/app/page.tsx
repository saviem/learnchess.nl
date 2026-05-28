import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { LevelCard } from "@/components/landing/LevelCard";
import { CoachingSection } from "@/components/landing/CoachingSection";
import { DIFFICULTY_LEVELS } from "@/lib/chess/difficulty";

export default function HomePage() {
  return (
    <MobileShell>
      <Header />
      <main className="flex-1 overflow-y-auto">
        <HeroSection />
        <div className="space-y-4 px-5 pb-6">
          {DIFFICULTY_LEVELS.map((level) => (
            <LevelCard key={level.id} level={level} />
          ))}
        </div>
        <CoachingSection />
        <section className="relative mx-5 mb-6 h-40 overflow-hidden rounded-2xl">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "linear-gradient(to top, rgba(15,23,42,0.85), rgba(15,23,42,0.2)), url('https://images.unsplash.com/photo-1529699211952-734e80c4d42b?auto=format&fit=crop&w=800&q=80')",
            }}
          />
          <p className="absolute bottom-4 left-4 right-4 text-lg font-bold text-white">
            Word een meester in je eigen tempo.
          </p>
        </section>
      </main>
      <BottomNav />
    </MobileShell>
  );
}
