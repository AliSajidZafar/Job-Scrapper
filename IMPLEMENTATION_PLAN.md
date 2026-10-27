# Implementation Plan — LinkedIn Job Market Intelligence Tool

## Build order

### Phase 1 — Data foundation
- [ ] **Step 1: Supabase schema**
  - Run `schema.sql` in Supabase SQL editor
  - Verify `jobs`, `job_stacks`, `scrape_runs` tables exist
  - Check `stack_trend` and `company_stack_map` views work

- [ ] **Step 2: Playwright scraper — SAP proof of concept**
  - Node.js script using Playwright
  - Load LinkedIn session cookie from a JSON file
  - Search: keyword = "SAP", filters = today · US + Remote · contract + full-time · Easy Apply
  - Paginate through results, log raw job data to console
  - Confirm applicant count is being extracted

- [ ] **Step 3: Supabase upsert logic**
  - Connect scraper to Supabase (`@supabase/supabase-js`)
  - Upsert into `jobs` (dedup by `linkedin_job_id`)
  - Insert into `job_stacks`
  - Log run result to `scrape_runs`

- [ ] **Step 4: Extend scraper to all 5 stacks**
  - Loop: SAP → Salesforce → MERN → .NET → Java
  - Add random delays between stacks (5–10s)
  - Run manually, confirm data lands in Supabase

---

### Phase 2 — Dashboard

- [ ] **Step 5: Next.js scaffold**
  - `npx create-next-app@latest` with App Router + TypeScript
  - Install `@supabase/supabase-js`, `@supabase/ssr`
  - Connect to Supabase, fetch from `jobs`, display as a basic table (Tab 4 raw feed)

- [ ] **Step 6: Trend chart (Tab 1)**
  - Query `stack_trend` view
  - Line chart using Recharts or Chart.js
  - One line per stack, x = day, y = job count
  - Wait until you have at least 3–5 days of data before building this

- [ ] **Step 7: Applicant Competition table (Tab 2)**
  - Query `jobs JOIN job_stacks`, sort by `applicant_count DESC`
  - Filterable by stack, date, job type

- [ ] **Step 8: Company Stack Map (Tab 3)**
  - Query `company_stack_map` view
  - Pivot table: company rows × stack columns

---

### Phase 3 — Automation & reliability

- [ ] **Step 9: Daily scheduler**
  - Option A: pg_cron in Supabase calling a Supabase Edge Function
  - Option B: Cron job on a VPS (simpler if you have one)
  - Set to run once per morning

- [ ] **Step 10: Cookie management**
  - Store cookie in Supabase Vault (Settings → Vault)
  - Scraper reads from Vault via service role key
  - Document the manual refresh process

- [ ] **Step 11: Error alerting**
  - On scrape failure, send a notification
  - Simple option: POST to a Discord webhook
  - Check `scrape_runs.status` on the dashboard header

---

## Decisions to make before starting

| Decision | Options |
|---|---|
| Scraper hosting | Local machine (dev) → VPS / Railway / Render (prod) |
| Supabase hosting | Local Docker (dev) → self-hosted VPS (prod) |
| Cookie refresh | Manual export from browser, paste into Vault |
| Failure notification | Discord webhook (easiest), email, or dashboard only |
| Extra stacks | Python, React, AWS — add later if needed |

---

## Key files
| File | Purpose |
|---|---|
| `CLAUDE.md` | Project context for Claude in this folder |
| `REQUIREMENTS.md` | Full requirements spec |
| `schema.sql` | Supabase Postgres schema — run this first |
| `IMPLEMENTATION_PLAN.md` | This file |
