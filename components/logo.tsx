import Link from "next/link";

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="cj-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e40af" />
          <stop offset="1" stopColor="#c49a45" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#cj-g)" opacity="0.1" />
      <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill="none" stroke="url(#cj-g)" strokeOpacity="0.6" />
      <path d="M20.5 10.5a7 7 0 1 0 0 11" fill="none" stroke="url(#cj-g)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="m15 16.2 2.2 2.2 4.6-4.8" fill="none" stroke="#172554" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight text-fg">
      <LogoMark />
      <span className="text-[17px]">
        Co<span className="text-gradient">Judge</span>
      </span>
    </Link>
  );
}
