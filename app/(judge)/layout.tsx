import { Backdrop } from "@/components/backdrop";
import { JudgeNav } from "@/components/judge-nav";
import { getSession } from "@/lib/auth";

export default async function JudgeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <>
      <Backdrop intensity="soft" />
      {session && <JudgeNav name={session.name} role={session.role} />}
      <main id="main" className={session ? "mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6" : ""}>
        {children}
      </main>
    </>
  );
}
