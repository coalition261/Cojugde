"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, Mail, Trophy } from "lucide-react";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Teams", icon: LayoutDashboard, organizerOnly: false },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy, organizerOnly: false },
  { href: "/emails", label: "Emails", icon: Mail, organizerOnly: true },
];

export function JudgeNav({ name, role }: { name: string; role: "judge" | "organizer" }) {
  const path = usePathname();
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <nav aria-label="Judge" className="glass-strong mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 rounded-2xl px-4 sm:px-5">
        <Logo href="/dashboard" />
        <ul className="flex items-center gap-1">
          {LINKS.filter((l) => !l.organizerOnly || role === "organizer").map((l) => {
            const active = path === l.href || (l.href === "/dashboard" && path.startsWith("/teams"));
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-200",
                    active ? "bg-white/[0.07] text-fg" : "text-fg-muted hover:text-fg",
                  )}
                >
                  <l.icon className="size-4" aria-hidden />
                  <span className="hidden sm:inline">{l.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight">{name}</p>
            <p className="text-xs capitalize text-fg-subtle">{role}</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button type="submit" aria-label="Sign out" className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-danger/10 hover:text-danger">
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
