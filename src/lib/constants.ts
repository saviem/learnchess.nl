export const APP_NAME = "learnchess.nl";

export type NavItem = "play" | "lessons" | "puzzles" | "stats";

export const NAV_ITEMS: {
  id: NavItem;
  label: string;
  href: string;
  icon: "play" | "book" | "star" | "chart";
}[] = [
  { id: "play", label: "Play", href: "/", icon: "play" },
  { id: "lessons", label: "Lessons", href: "/lessons", icon: "book" },
  { id: "puzzles", label: "Puzzles", href: "/puzzles", icon: "star" },
  { id: "stats", label: "Stats", href: "/stats", icon: "chart" },
];
