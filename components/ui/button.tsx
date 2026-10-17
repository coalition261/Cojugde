import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[background-color,box-shadow,transform,color,border-color] duration-200 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg shadow-[0_1px_2px_rgba(23,37,84,0.25)] hover:bg-primary-strong",
        secondary: "border border-[#e2e8f0] bg-white text-primary shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50",
        ghost: "text-fg-muted hover:bg-glass hover:text-fg",
        success: "bg-success/10 text-success-ink ring-1 ring-success/30 hover:bg-success/15",
        danger: "bg-danger/10 text-danger-ink ring-1 ring-danger/30 hover:bg-danger/15",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-11 px-5",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
