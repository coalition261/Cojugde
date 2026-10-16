import Link from "next/link";
import { Backdrop } from "@/components/backdrop";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Backdrop intensity="soft" />
      <p className="tabular font-mono text-6xl font-semibold text-gradient">404</p>
      <h1 className="mt-4 text-2xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-fg-muted">The link may be mistyped, or the report token may be wrong. Check the link in your email.</p>
      <Link href="/" className={`${buttonVariants()} mt-8`}>
        Back to home
      </Link>
    </main>
  );
}
