import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-xl border border-glass-border bg-white px-4 text-base text-fg placeholder:text-fg-subtle transition-[border-color,box-shadow,background-color] duration-200 hover:border-slate-300 focus:border-primary/60 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-danger/60 aria-[invalid=true]:ring-danger/15 disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(field, "h-12", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(field, "min-h-28 py-3", className)} {...props} />,
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-fg", className)} {...props} />;
}
