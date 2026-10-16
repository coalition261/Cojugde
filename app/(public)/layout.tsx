import { Backdrop } from "@/components/backdrop";
import { SiteNav } from "@/components/site-nav";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Backdrop intensity="soft" />
      <SiteNav />
      <main id="main" className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-6">
        {children}
      </main>
    </>
  );
}
