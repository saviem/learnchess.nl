"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Gamepad2,
  Star,
} from "lucide-react";
import { NAV_ITEMS, type NavItem } from "@/lib/constants";

function getActiveNav(pathname: string): NavItem {
  if (pathname.startsWith("/lessons")) return "lessons";
  if (pathname.startsWith("/puzzles")) return "puzzles";
  if (pathname.startsWith("/stats")) return "stats";
  return "play";
}

function NavIcon({ icon, active }: { icon: string; active: boolean }) {
  const className = `h-5 w-5 ${active ? "text-navy" : "text-muted"}`;

  switch (icon) {
    case "play":
      return <Gamepad2 className={className} />;
    case "book":
      return <BookOpen className={className} />;
    case "star":
      return <Star className={className} />;
    case "chart":
      return <BarChart3 className={className} />;
    default:
      return <Gamepad2 className={className} />;
  }
}

export function BottomNav() {
  const pathname = usePathname();
  const active = getActiveNav(pathname);

  return (
    <nav className="mt-auto border-t border-slate-100 bg-white px-2 py-2">
      <ul className="grid grid-cols-4 gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition ${
                  isActive
                    ? "bg-sky-100 text-navy"
                    : "text-muted hover:bg-slate-50"
                }`}
              >
                <NavIcon icon={item.icon} active={isActive} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
