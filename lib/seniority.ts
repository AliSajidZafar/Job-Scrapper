// Experience level inferred from a job title. LinkedIn doesn't give us a clean
// seniority field, so we read it from the title with a small keyword heuristic:
// senior markers win, then junior markers, otherwise it's treated as mid-level.
// Shown to the user as Junior / Intermediate / Advanced.

export type Seniority = "junior" | "mid" | "senior";

const SENIOR = /\b(senior|sr\.?|lead|principal|staff|architect|head|director|vp|manager|expert|iii|iv)\b/i;
const JUNIOR = /\b(junior|jr\.?|entry[-\s]?level|entry|associate|graduate|grad|intern|trainee|apprentice|fresher)\b/i;

export function seniorityOf(title: string): Seniority {
  if (SENIOR.test(title)) return "senior";
  if (JUNIOR.test(title)) return "junior";
  return "mid";
}

export const SENIORITY_LABEL: Record<Seniority, string> = {
  junior: "Junior",
  mid: "Intermediate",
  senior: "Advanced",
};

// Order they should always render in (least → most senior).
export const SENIORITY_ORDER: Seniority[] = ["junior", "mid", "senior"];
