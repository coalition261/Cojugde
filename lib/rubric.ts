export const CRITERIA = [
  { key: "technical", label: "Technical execution and reliability", weight: 25 },
  { key: "usefulness", label: "Usefulness and real-world impact", weight: 20 },
  { key: "theme", label: "Theme alignment", weight: 15 },
  { key: "creativity", label: "Creativity and uniqueness", weight: 15 },
  { key: "automation", label: "Automation depth and integration", weight: 15 },
  { key: "ux", label: "User experience and presentation", weight: 10 },
] as const;

export type CriterionKey = (typeof CRITERIA)[number]["key"];
export const CRITERION_KEYS = CRITERIA.map((c) => c.key) as [CriterionKey, ...CriterionKey[]];
export const WEIGHT: Record<CriterionKey, number> = Object.fromEntries(
  CRITERIA.map((c) => [c.key, c.weight]),
) as Record<CriterionKey, number>;

export const TOTAL_GAP_THRESHOLD = 15;
export const CRITERION_GAP_RATIO = 0.4;

export type Gap = {
  totalGap: number;
  aiTotal: number;
  perCriterion: { key: CriterionKey; human: number; ai: number; gap: number; big: boolean }[];
  secondLook: boolean;
};

/** Gap rule: total gap of 15+ points, or any criterion gap of 40%+ of its weight. */
export function computeGap(human: Record<string, number>, ai: Record<string, number>): Gap {
  const perCriterion = CRITERIA.map((c) => {
    const h = human[c.key] ?? 0;
    const a = ai[c.key] ?? 0;
    const gap = Math.abs(h - a);
    return { key: c.key, human: h, ai: a, gap, big: gap >= CRITERION_GAP_RATIO * c.weight };
  });
  const humanTotal = perCriterion.reduce((s, c) => s + c.human, 0);
  const aiTotal = perCriterion.reduce((s, c) => s + c.ai, 0);
  const totalGap = Math.abs(humanTotal - aiTotal);
  return {
    totalGap,
    aiTotal,
    perCriterion,
    secondLook: totalGap >= TOTAL_GAP_THRESHOLD || perCriterion.some((c) => c.big),
  };
}
