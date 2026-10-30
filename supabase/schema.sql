-- LinkedIn Job Market Intelligence Tool
-- Supabase / Postgres schema  (canonical location — run this in the SQL editor)
--
-- Faithful to the root schema.sql design. The only change from that file is the
-- NULLS LAST fix on the applicant-count ordering (see note below); every other
-- design suggestion is left for you to decide and is written up in the README.

-- ============================================================
-- jobs  — one row per unique job listing scraped from LinkedIn
-- ============================================================
CREATE TABLE jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_job_id  text UNIQUE NOT NULL,        -- LinkedIn's internal job ID (dedup key)
  title            text NOT NULL,
  company          text NOT NULL,
  location         text,                         -- City/State or "Remote"
  job_type         text CHECK (job_type IN ('contract', 'full_time')),
  easy_apply       boolean DEFAULT false,
  applicant_count  integer,                      -- Number shown on LinkedIn at scrape time
  posted_at        date,                         -- Date the job was posted (from LinkedIn)
  scraped_at       timestamptz DEFAULT now()     -- When this row was first inserted
);

CREATE INDEX idx_jobs_scraped_at ON jobs (scraped_at DESC);
CREATE INDEX idx_jobs_company    ON jobs (company);
-- FIX: NULLS LAST so jobs with an unknown applicant count sort to the bottom of
-- the competition table instead of the top (Postgres orders NULLs first on DESC).
CREATE INDEX idx_jobs_applicants ON jobs (applicant_count DESC NULLS LAST);

-- ============================================================
-- job_stacks  — many-to-many: one job can match multiple stacks
-- ============================================================
CREATE TABLE job_stacks (
  job_id  uuid NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  stack   text NOT NULL CHECK (stack IN ('SAP', 'Salesforce', 'MERN', '.NET', 'Java', 'ServiceNow', 'Workday', 'Data Engineering', 'DevOps', 'AI / ML')),
  PRIMARY KEY (job_id, stack)
);

CREATE INDEX idx_job_stacks_stack ON job_stacks (stack);

-- ============================================================
-- scrape_runs  — audit log of each daily scrape
-- ============================================================
CREATE TABLE scrape_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at         timestamptz DEFAULT now(),
  jobs_found     integer DEFAULT 0,
  status         text CHECK (status IN ('success', 'partial', 'failed')),
  error_message  text                             -- NULL on success
);

-- ============================================================
-- Views
-- ============================================================

-- Daily job count per stack (for the trend chart).
CREATE OR REPLACE VIEW stack_trend AS
SELECT
  (j.scraped_at AT TIME ZONE 'UTC')::date AS day,
  js.stack,
  COUNT(*)                                AS job_count
FROM jobs j
JOIN job_stacks js ON js.job_id = j.id
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- Company stack map (for Tab 3).
CREATE OR REPLACE VIEW company_stack_map AS
SELECT
  j.company,
  js.stack,
  COUNT(*) AS open_roles
FROM jobs j
JOIN job_stacks js ON js.job_id = j.id
GROUP BY 1, 2
ORDER BY 1, 2;

-- ============================================================
-- search_snapshots  (suggestion #2 — fixes cap saturation)
-- One row per stack per run: LinkedIn's reported "N results" for the search,
-- recorded even though we only scrape up to maxJobsPerStack jobs in detail.
-- This is the honest demand signal for the trend — a 200-job cap can't flatten
-- it, because total_results is the full count LinkedIn shows.
-- ============================================================
CREATE TABLE search_snapshots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stack          text NOT NULL CHECK (stack IN ('SAP', 'Salesforce', 'MERN', '.NET', 'Java', 'ServiceNow', 'Workday', 'Data Engineering', 'DevOps', 'AI / ML')),
  total_results  integer,                      -- LinkedIn's "N results" for the search
  scraped_count  integer,                      -- how many we captured in detail (<= cap)
  searched_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_search_snapshots_stack ON search_snapshots (stack, searched_at DESC);

-- Daily demand per stack, from the reported result totals (for the trend chart).
-- MAX() in case a day has more than one run; falls back to scraped_count.
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
-- One row per job per run. With two or more runs you can compute how fast a
-- posting accumulates applicants (applicants/hour), which separates a crowded
-- role from a fresh one far better than a single <24h snapshot.
-- ============================================================
CREATE TABLE job_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  applicant_count integer,
  observed_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_job_snapshots_job ON job_snapshots (job_id, observed_at DESC);

-- Applicant velocity per job: first vs latest observation -> applicants/hour.
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
JOIN bounds b        ON b.job_id = j.id
JOIN job_snapshots fs ON fs.job_id = j.id AND fs.observed_at = b.first_at
JOIN job_snapshots ls ON ls.job_id = j.id AND ls.observed_at = b.last_at;
