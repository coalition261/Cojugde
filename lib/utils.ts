import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** gsk_ABCDEFGH...ab12 → gsk_••••ab12. Never store or send the full value. */
export function maskSecret(value: string): string {
  const m = value.match(/^(gsk_|sk-|AIza|ghp_|AKIA)/);
  const prefix = m ? m[1] : value.slice(0, 3);
  return `${prefix}••••${value.slice(-4)}`;
}

export function formatPkt(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}
