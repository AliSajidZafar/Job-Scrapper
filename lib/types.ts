// Shared domain types for the LinkedIn Job Market Intelligence Tool.
// Mirrors the tables and views defined in supabase/schema.sql.

export const STACKS = ["SAP", "Salesforce", "MERN", ".NET", "Java"] as const;
export type Stack = (typeof STACKS)[number];

// Stack -> CSS custom property holding its (theme-aware) categorical color.
// Colors are the dataviz reference's first five validated slots, in order.
export const STACK_COLOR_VAR: Record<Stack, string> = {
  SAP: "--s-sap",
  Salesforce: "--s-salesforce",
  MERN: "--s-mern",
  ".NET": "--s-net",
  Java: "--s-java",
};

export type JobType = "contract" | "full_time";

export interface Job {
  id: string;
  linkedin_job_id: string;
  title: string;
  company: string;
  location: string | null;
  job_type: JobType | null;
  easy_apply: boolean;
  applicant_count: number | null;
  posted_at: string | null; // ISO date
  scraped_at: string; // ISO timestamp
  stacks: Stack[];
  applicants_per_hour?: number | null; // from job_applicant_velocity, once >=2 runs exist
}

export interface TrendPoint {
  day: string; // ISO date
  stack: Stack;
  job_count: number; // demand value plotted: LinkedIn result total, else scraped count
  scraped_count?: number; // how many jobs we captured in detail that day
}

// One stack's reported result total for a single run (search_snapshots).
export interface SearchSnapshot {
  stack: Stack;
  total_results: number | null;
  scraped_count: number | null;
  searched_at: string;
}

export interface CompanyStackRow {
  company: string;
  // open role count per stack, keyed by stack name
  counts: Partial<Record<Stack, number>>;
  total: number;
}

export interface ScrapeRun {
  id: string;
  ran_at: string;
  jobs_found: number;
  status: "success" | "partial" | "failed";
  error_message: string | null;
}

// Per-stack headline numbers for the "Market at a glance" section.
export interface StackSummary {
  stack: Stack;
  open_roles: number | null; // LinkedIn's reported result total (demand)
  captured: number; // jobs we scraped in detail for this stack
  avg_applicants: number | null; // mean applicants over the captured sample
  max_applicants: number | null;
}

export interface SummaryData {
  totals: { open_roles: number; captured: number; avg_applicants: number | null };
  stacks: StackSummary[];
}

// Shape returned by every dashboard API route so the UI can tell
// "no Supabase configured" apart from "configured but no rows yet".
export interface ApiResult<T> {
  configured: boolean;
  data: T;
  error?: string;
}
