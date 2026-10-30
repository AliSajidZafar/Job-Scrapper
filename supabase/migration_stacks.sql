-- ============================================================
-- migration_stacks.sql  (2026-10-30)
-- Adds 5 new stacks (ServiceNow, Workday, Data Engineering, DevOps, AI / ML)
-- to the 5 existing ones. The stack name is validated by a CHECK constraint on
-- two tables, so both must be widened before the scraper can insert new rows.
-- Idempotent: safe to run more than once. Run this in the Supabase SQL editor
-- BEFORE the next scrape.
-- ============================================================

-- job_stacks.stack
ALTER TABLE job_stacks DROP CONSTRAINT IF EXISTS job_stacks_stack_check;
ALTER TABLE job_stacks ADD CONSTRAINT job_stacks_stack_check
  CHECK (stack IN ('SAP', 'Salesforce', 'MERN', '.NET', 'Java',
                   'ServiceNow', 'Workday', 'Data Engineering', 'DevOps', 'AI / ML'));

-- search_snapshots.stack
ALTER TABLE search_snapshots DROP CONSTRAINT IF EXISTS search_snapshots_stack_check;
ALTER TABLE search_snapshots ADD CONSTRAINT search_snapshots_stack_check
  CHECK (stack IN ('SAP', 'Salesforce', 'MERN', '.NET', 'Java',
                   'ServiceNow', 'Workday', 'Data Engineering', 'DevOps', 'AI / ML'));
