// Shared domain types for the LinkedIn Job Market Intelligence Tool.
// Mirrors the tables and views defined in supabase/schema.sql.

import type { Seniority } from "./seniority";

export const STACKS = [
  "SAP",
  "Salesforce",
  "MERN",
  ".NET",
  "Java",
  "ServiceNow",
  "Workday",
  "Data Engineering",
  "DevOps",
  "AI / ML",
  // Niche / specialist stacks (set 2) — low-competition, high-barrier markets.
  "Rust",
  "Elixir",
  "C++",
  "Haskell",
  "SRE",
  "Embedded",
  "GIS",
  "COBOL",
  "CUDA",
  "Edge AI",
] as const;
export type Stack = (typeof STACKS)[number];

// Stack -> CSS custom property holding its (theme-aware) categorical color.
// Ten validated categorical slots (dataviz palette, CVD-safe both modes — see
// globals.css). The first five are unchanged for data continuity.
export const STACK_COLOR_VAR: Record<Stack, string> = {
  SAP: "--s-sap",
  Salesforce: "--s-salesforce",
  MERN: "--s-mern",
  ".NET": "--s-net",
  Java: "--s-java",
  ServiceNow: "--s-servicenow",
  Workday: "--s-workday",
  "Data Engineering": "--s-data",
  DevOps: "--s-devops",
  "AI / ML": "--s-ml",
  Rust: "--s-rust",
  Elixir: "--s-elixir",
  "C++": "--s-cpp",
  Haskell: "--s-haskell",
  SRE: "--s-sre",
  Embedded: "--s-embedded",
  GIS: "--s-gis",
  COBOL: "--s-cobol",
  CUDA: "--s-cuda",
  "Edge AI": "--s-edgeai",
};

// Compact labels for tight spots (tiles, filter pills, chart legends).
export const STACK_SHORT: Record<Stack, string> = {
  SAP: "SAP",
  Salesforce: "Salesforce",
  MERN: "MERN",
  ".NET": ".NET",
  Java: "Java",
  ServiceNow: "ServiceNow",
  Workday: "Workday",
  "Data Engineering": "Data Eng",
  DevOps: "DevOps",
  "AI / ML": "AI / ML",
  Rust: "Rust",
  Elixir: "Elixir",
  "C++": "C++",
  Haskell: "Haskell",
  SRE: "SRE",
  Embedded: "Embedded",
  GIS: "GIS",
  COBOL: "COBOL",
  CUDA: "CUDA",
  "Edge AI": "Edge AI",
};

export type JobType = "contract" | "full_time";

// Signed-in visitor. "admin" comes only from Supabase app_metadata.role, which
// users can't edit themselves; everyone who signs up is a "user".
export type Role = "admin" | "user";
export interface SessionUser {
  name: string;
  role: Role;
}

export interface Job {
  id: string;
  linkedin_job_id: string;
  title: string;
  company: string;
  location: string | null;
  job_type: JobType | null;
  easy_apply: boolean | null; // null = apply route unknown (older rows / failed detail)
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
  // Movers: open roles vs the previous scrape day and vs ~a week earlier.
  prev_day: string | null; // ISO date of the comparison day
  prev_open_roles: number | null;
  change_pct: number | null; // vs prev_day
  change_week_pct: number | null; // vs the latest day at least 7 days back
}

// A job whose applicant count grew between two scrape runs.
export interface FastJob {
  id: string;
  linkedin_job_id: string;
  title: string;
  company: string;
  location: string | null;
  stacks: Stack[];
  first_count: number | null;
  latest_count: number | null;
  hours_tracked: number | null;
  applicants_per_hour: number;
}

// GET /api/opportunities — where competition is thin, from the latest scrape.
export interface OpportunitiesData {
  as_of: string | null; // latest scrape time (ISO)
  scanned: number; // jobs seen in the latest scrape window
  max_applicants: number; // upper bound used for `low`
  low: Job[]; // jobs at or under max_applicants, fewest first
  fastest: FastJob[]; // highest applicants/hour
}

export interface SummaryData {
  totals: {
    open_roles: number;
    captured: number;
    total_applicants: number; // sum of applicant counts across all captured jobs
    avg_applicants: number | null;
  };
  stacks: StackSummary[];
}

// Shape returned by every dashboard API route so the UI can tell
// "no Supabase configured" apart from "configured but no rows yet".
export interface ApiResult<T> {
  configured: boolean;
  data: T;
  error?: string;
}

// One job inside a stack's detail view (GET /api/stack).
export interface StackJob {
  id: string;
  linkedin_job_id: string;
  title: string;
  company: string;
  location: string | null;
  job_type: JobType | null;
  applicant_count: number | null;
  posted_at: string | null;
  seniority: Seniority;
  applicants_per_hour: number | null;
}

// GET /api/prime — the hottest low-competition, high-demand roles across all
// stacks (see lib/prime.ts for what qualifies).
export interface PrimeJob {
  id: string;
  linkedin_job_id: string;
  title: string;
  company: string;
  location: string | null;
  stacks: Stack[];
  applicant_count: number;
  open_roles: number; // demand: the best (largest) open-roles total among its stacks
  applicants_per_hour: number | null; // bonus demand signal when known
}
export interface PrimeData {
  as_of: string | null; // latest scrape time (ISO) — these are fresh roles
  jobs: PrimeJob[]; // hottest first
}

// GET /api/refresh?id=<linkedin_job_id> — a single job's current applicant
// count, fetched live from LinkedIn on demand.
export interface RefreshResult {
  linkedin_job_id: string;
  applicant_count: number | null;
  applicant_text: string | null; // LinkedIn's exact wording, e.g. "Over 200 applicants"
  checked_at: string; // ISO time the live check ran
}

// GET /api/company?name=<company> — the per-company drill-down.
export interface CompanyDetail {
  company: string;
  as_of: string | null; // newest scrape time among this company's jobs (ISO)
  captured: number; // tracked postings for this company
  stacks: { stack: Stack; count: number }[]; // which stacks they hire for, most first
  applicants: {
    withCount: number;
    avg: number | null;
    median: number | null;
    max: number | null;
  };
  seniority: Record<Seniority, number>;
  jobs: StackJob[]; // individual postings, fewest applicants first
}

// GET /api/stack?stack=<name> — everything the per-stack drill-down shows.
export interface StackDetail {
  stack: Stack;
  as_of: string | null; // latest scrape time for this stack (ISO)
  open_roles: number | null; // LinkedIn's latest result total
  prev_open_roles: number | null;
  change_pct: number | null; // open roles vs the previous scrape day
  captured: number; // jobs pulled in detail
  applicants: {
    withCount: number; // jobs that reported an applicant count
    avg: number | null;
    median: number | null;
    max: number | null;
    total: number;
  };
  seniority: Record<Seniority, number>; // job counts by experience level
  trend: { day: string; open_roles: number | null; captured: number }[]; // oldest → newest
  companies: { company: string; count: number; avg_applicants: number | null }[]; // top hirers
  jobs: StackJob[]; // individual postings, fewest applicants first
}
