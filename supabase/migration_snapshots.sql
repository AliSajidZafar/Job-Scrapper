-- Migration: add the snapshot tables + views for suggestions #2 and #3.
-- Run this in the Supabase SQL editor on a database that ALREADY has
-- jobs / job_stacks / scrape_runs (i.e. you ran the original schema first).
-- Fully idempotent — safe to run more than once.

-- Fix: competition sort should push unknown applicant counts to the bottom.
DROP INDEX IF EXISTS idx_jobs_applicants;
CREATE INDEX idx_jobs_applicants ON jobs (applicant_count DESC NULLS LAST);

-- ============================================================
-- search_snapshots  (suggestion #2 — reported result total per run)
-- ============================================================
CREATE TABLE IF NOT EXISTS search_snapshots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stack          text NOT NULL CHECK (stack IN ('SAP', 'Salesforce', 'MERN', '.NET', 'Java')),
  total_results  integer,
  scraped_count  integer,
  searched_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_snapshots_stack
  ON search_snapshots (stack, searched_at DESC);

CREATE OR REPLACE VIEW stack_demand AS
SELECT
  (searched_at AT TIME ZONE 'UTC')::date       AS day,
  stack,
  MAX(total_results)                           AS total_results,
  MAX(scraped_count)                           AS scraped_count
FROM search_snapshots
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- ============================================================
-- job_snapshots  (suggestion #3 — applicant count over time)
-- ============================================================
CREATE TABLE IF NOT EXISTS job_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  applicant_count integer,
  observed_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_snapshots_job
  ON job_snapshots (job_id, observed_at DESC);

CREATE OR REPLACE VIEW job_applicant_velocity AS
WITH bounds AS (
  SELECT job_id, MIN(observed_at) AS first_at, MAX(observed_at) AS last_at
  FROM job_snapshots
  GROUP BY job_id
)
SELECT
  j.id,
  j.linkedin_job_id,
  j.title,
  j.company,
  fs.applicant_count                                              AS first_count,
  ls.applicant_count                                              AS latest_count,
  b.last_at                                                       AS observed_at,
  ROUND(EXTRACT(EPOCH FROM (b.last_at - b.first_at)) / 3600.0, 1) AS hours_tracked,
  CASE
    WHEN b.last_at > b.first_at
     AND ls.applicant_count IS NOT NULL
     AND fs.applicant_count IS NOT NULL
    THEN ROUND(
      (ls.applicant_count - fs.applicant_count)
        / (EXTRACT(EPOCH FROM (b.last_at - b.first_at)) / 3600.0),
      2
    )
    ELSE NULL
  END                                                             AS applicants_per_hour
FROM jobs j
JOIN bounds b         ON b.job_id = j.id
JOIN job_snapshots fs ON fs.job_id = j.id AND fs.observed_at = b.first_at
JOIN job_snapshots ls ON ls.job_id = j.id AND ls.observed_at = b.last_at;
