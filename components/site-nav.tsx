"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#checks", label: "Checks" },
  { href: "/#human", label: "Human in the loop" },
];

/** Floating glass navbar for public pages. */
export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <nav
        aria-label="Main"
        className={cn(
          "mx-auto flex h-16 max-w-6xl items-center justify-between rounded-2xl px-4 transition-[background-color,box-shadow,border-color] duration-300 sm:px-5",
          scrolled ? "glass-strong" : "border border-transparent",
        )}
      >
        <Logo />
        <ul className="hidden items-center gap-0.5 md:flex lg:gap-1">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium text-fg transition-colors duration-200 hover:text-primary-strong lg:px-3">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-fg hover:text-primary-strong")}>
            Judge sign in
          </Link>
          <Link href="/submit" className={buttonVariants({ size: "sm" })}>
            Submit project
          </Link>
        </div>
        <button
          type="button"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </nav>
      {open && (
        <div className="glass-strong mx-auto mt-2 max-w-6xl rounded-2xl p-3 md:hidden">
          <ul className="flex flex-col">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-fg-muted hover:bg-glass hover:text-fg">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link href="/login" className={buttonVariants({ variant: "secondary" })}>
              Judge sign in
            </Link>
            <Link href="/submit" className={buttonVariants()}>
              Submit
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
