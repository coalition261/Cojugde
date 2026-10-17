import type { Metadata } from "next";
import { SubmitForm } from "./submit-form";

export const metadata: Metadata = { title: "Submit your project" };

export default function SubmitPage() {
  return (
    <>
      <header className="mb-8">
        <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-accent-ink">Pre-flight</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Submit your project</h1>
        <p className="mt-3 text-fg-muted">
          We check your deployment, repo, code freeze, secrets and video in under 30 seconds. If anything is broken you&apos;ll get a
          private report and an email with a fix tip. Resubmit as often as you need (up to 5 runs per hour).
        </p>
      </header>
      <SubmitForm />
    </>
  );
}
