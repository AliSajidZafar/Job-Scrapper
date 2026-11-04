-- ============================================================
-- migration_stacks_v2.sql  (2026-11-04)
-- Adds 10 niche/specialist stacks (Rust, Elixir, C++, Haskell, SRE, Embedded,
-- GIS, COBOL, CUDA, Edge AI) to the existing 10. The stack name is validated by
-- a CHECK constraint on two tables, so both must be widened before the scraper
-- can insert the new rows. Idempotent: safe to run more than once. Run this in
-- the Supabase SQL editor BEFORE the next scrape.
-- ============================================================

-- job_stacks.stack
ALTER TABLE job_stacks DROP CONSTRAINT IF EXISTS job_stacks_stack_check;
ALTER TABLE job_stacks ADD CONSTRAINT job_stacks_stack_check
  CHECK (stack IN ('SAP', 'Salesforce', 'MERN', '.NET', 'Java',
                   'ServiceNow', 'Workday', 'Data Engineering', 'DevOps', 'AI / ML',
                   'Rust', 'Elixir', 'C++', 'Haskell', 'SRE',
                   'Embedded', 'GIS', 'COBOL', 'CUDA', 'Edge AI'));

-- search_snapshots.stack
ALTER TABLE search_snapshots DROP CONSTRAINT IF EXISTS search_snapshots_stack_check;
ALTER TABLE search_snapshots ADD CONSTRAINT search_snapshots_stack_check
  CHECK (stack IN ('SAP', 'Salesforce', 'MERN', '.NET', 'Java',
                   'ServiceNow', 'Workday', 'Data Engineering', 'DevOps', 'AI / ML',
                   'Rust', 'Elixir', 'C++', 'Haskell', 'SRE',
                   'Embedded', 'GIS', 'COBOL', 'CUDA', 'Edge AI'));
