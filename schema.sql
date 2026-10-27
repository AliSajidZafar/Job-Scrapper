-- LinkedIn Job Market Intelligence Tool
-- Supabase / Postgres schema
-- Run this in your Supabase SQL editor

-- ============================================================
-- jobs
-- One row per unique job listing scraped from LinkedIn
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
  scraped_at       timestamptz DEFAULT now()     -- When this row was inserted
);

CREATE INDEX idx_jobs_scraped_at   ON jobs (scraped_at DESC);
CREATE INDEX idx_jobs_company      ON jobs (company);
CREATE INDEX idx_jobs_applicants   ON jobs (applicant_count DESC);

-- ============================================================
-- job_stacks
-- Many-to-many: one job can match multiple stacks
-- ============================================================
CREATE TABLE job_stacks (
  job_id  uuid NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  stack   text NOT NULL CHECK (stack IN ('SAP', 'Salesforce', 'MERN', '.NET', 'Java')),
  PRIMARY KEY (job_id, stack)
);

CREATE INDEX idx_job_stacks_stack ON job_stacks (stack);

-- ============================================================
-- scrape_runs
-- Audit log of each daily scrape
-- ============================================================
CREATE TABLE scrape_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at         timestamptz DEFAULT now(),
  jobs_found     integer DEFAULT 0,
  status         text CHECK (status IN ('success', 'partial', 'failed')),
  error_message  text                             -- NULL on success
);

-- ============================================================
-- Useful views
-- ============================================================

-- Daily job count per stack (for the trend chart)
CREATE OR REPLACE VIEW stack_trend AS
SELECT
  (j.scraped_at AT TIME ZONE 'UTC')::date AS day,
  js.stack,
  COUNT(*)                                AS job_count
FROM jobs j
JOIN job_stacks js ON js.job_id = j.id
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- Company stack map (for Tab 3)
CREATE OR REPLACE VIEW company_stack_map AS
SELECT
  j.company,
  js.stack,
  COUNT(*) AS open_roles
FROM jobs j
JOIN job_stacks js ON js.job_id = j.id
GROUP BY 1, 2
ORDER BY 1, 2;
