"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type Field = "teamName" | "contactEmail" | "repoUrl" | "deployUrl" | "videoUrl" | "workflowUrl" | "description";

const FIELDS: { name: Field; label: string; type?: string; placeholder: string; help: string; required?: boolean; autoComplete?: string }[] = [
  { name: "teamName", label: "Team name", placeholder: "Your team name", help: "Used to match resubmissions — keep it identical each time.", required: true, autoComplete: "organization" },
  { name: "contactEmail", label: "Contact email", type: "email", placeholder: "name@yourdomain.com", help: "Alerts and the report link go here.", required: true, autoComplete: "email" },
  { name: "repoUrl", label: "GitHub repository", type: "url", placeholder: "https://github.com/your-team/your-repo", help: "Must be public.", required: true },
  { name: "deployUrl", label: "Deployment URL", type: "url", placeholder: "https://your-service-app.alternatefutures.ai", help: "Your Alternate Clouds app URL (https, no port).", required: true },
  { name: "videoUrl", label: "Demo video", type: "url", placeholder: "https://youtu.be/…", help: "YouTube (unlisted is fine), 2–3 minutes.", required: true },
  { name: "workflowUrl", label: "Workflow JSON (optional)", type: "url", placeholder: "https://github.com/your-team/your-repo/blob/main/n8n/workflow.json", help: "Link to the exported n8n workflow in your repo." },
];

export function SubmitForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string[]>; reportUrl?: string };
      if (!res.ok) {
        const fieldErrors = Object.fromEntries(Object.entries(body.fields ?? {}).map(([k, v]) => [k, v[0]])) as Partial<Record<Field, string>>;
        setErrors(fieldErrors);
        setFormError(body.error ?? "Submission failed. Please retry.");
        const first = Object.keys(fieldErrors)[0];
        if (first) formRef.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
        return;
      }
      router.push(body.reportUrl ?? "/");
    } catch {
      setFormError("Network error — check your connection and retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
        <AnimatePresence>
          {formError && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger-ink"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {formError}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-6 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.name} className={f.name === "teamName" || f.name === "contactEmail" ? "" : "sm:col-span-2"}>
              <Label htmlFor={f.name}>
                {f.label}
                {f.required && <span className="text-danger-ink" aria-hidden> *</span>}
              </Label>
              <Input
                id={f.name}
                name={f.name}
                type={f.type ?? "text"}
                placeholder={f.placeholder}
                required={f.required}
                autoComplete={f.autoComplete ?? "off"}
                aria-invalid={!!errors[f.name]}
                aria-describedby={`${f.name}-help`}
                className="mt-2"
              />
              <p id={`${f.name}-help`} className={errors[f.name] ? "mt-1.5 text-sm text-danger-ink" : "mt-1.5 text-sm text-fg-subtle"}>
                {errors[f.name] ?? f.help}
              </p>
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label htmlFor="description">Project description</Label>
            <Textarea id="description" name="description" placeholder="What does it do, who is it for, and where do humans and AI meet?" aria-describedby="description-help" className="mt-2" />
            <p id="description-help" className="mt-1.5 text-sm text-fg-subtle">
              Optional, up to 4,000 characters. Don&apos;t include personal data.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse items-stretch gap-4 border-t border-glass-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-fg-subtle">Only team name, contact email and links are stored. Use synthetic data for tests.</p>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden /> Running checks…
              </>
            ) : (
              <>
                Run pre-flight <ArrowRight aria-hidden />
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
