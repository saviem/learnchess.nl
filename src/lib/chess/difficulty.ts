export type DifficultyLevel = "beginner" | "gevorderd" | "professional";

export interface DifficultyConfig {
  id: DifficultyLevel;
  title: string;
  description: string;
  cta: string;
  elo: number;
  skillLevel: number;
  coachTone: string;
  icon: "pawn" | "knight" | "king";
  featured?: boolean;
}

export const DIFFICULTY_LEVELS: DifficultyConfig[] = [
  {
    id: "beginner",
    title: "Beginner",
    description:
      "Ideaal voor nieuwe spelers. De AI maakt begrijpelijke fouten en geeft veel tips.",
    cta: "START NU",
    elo: 800,
    skillLevel: 4,
    coachTone: "eenvoudige taal, veel uitleg en alternatieven",
    icon: "pawn",
  },
  {
    id: "gevorderd",
    title: "Gevorderd",
    description:
      "Voor de clubschaker. Een uitdagende tegenstander die tactische fouten direct straft.",
    cta: "DAAG UIT",
    elo: 1400,
    skillLevel: 11,
    coachTone: "tactische termen en straffere feedback",
    icon: "knight",
    featured: true,
  },
  {
    id: "professional",
    title: "Professional",
    description:
      "Onverslaanbaar? Test je kracht tegen onze hoogste moeilijkheidsgraad.",
    cta: "PROBEER HET",
    elo: 2200,
    skillLevel: 19,
    coachTone: "bondig, diepgaand, weinig handholding",
    icon: "king",
  },
];

export function getDifficultyConfig(level: string): DifficultyConfig {
  return (
    DIFFICULTY_LEVELS.find((item) => item.id === level) ?? DIFFICULTY_LEVELS[1]
  );
}

export function isValidLevel(level: string): level is DifficultyLevel {
  return DIFFICULTY_LEVELS.some((item) => item.id === level);
}
