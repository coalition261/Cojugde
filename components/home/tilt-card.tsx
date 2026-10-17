"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

/** Glass card with a subtle 3D tilt and light glare that follows the pointer. */
export function TiltCard({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rx = useSpring(useTransform(y, [0, 1], [7, -7]), { stiffness: 220, damping: 22 });
  const ry = useSpring(useTransform(x, [0, 1], [-9, 9]), { stiffness: 220, damping: 22 });
  const glare = useTransform([x, y], ([gx, gy]) => `radial-gradient(420px circle at ${Number(gx) * 100}% ${Number(gy) * 100}%, rgba(30,64,175,0.06), transparent 45%)`);

  return (
    <motion.div
      ref={ref}
      onPointerMove={(e) => {
        if (reduce || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width);
        y.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        x.set(0.5);
        y.set(0.5);
      }}
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className={cn("glass group relative rounded-2xl [transform-style:preserve-3d]", className)}
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: glare }} />
      <div className="relative [transform:translateZ(24px)]">{children}</div>
    </motion.div>
  );
}
