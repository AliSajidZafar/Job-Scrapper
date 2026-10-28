# LinkedIn Job Market Intelligence Tool

## What this project is
A daily scraping and market intelligence tool that monitors LinkedIn job postings to track which tech stacks (SAP, Salesforce, MERN, .NET, Java) are rising or falling in demand — measured by job count and applicant competition across the US market.

## Tech stack
- **Frontend:** Next.js (App Router)
- **Database:** Supabase (self-hosted, Postgres)
- **Scraper:** Playwright (Node.js)
- **Scheduler:** pg_cron via Supabase Edge Functions
- **LinkedIn auth:** Session cookie from a LinkedIn Premium account

## Project structure (to be built)
```
linkedin-scraper/
├── scraper/          # Playwright Node.js scraper
│   ├── index.js      # Entry point — runs all 5 stacks
│   ├── scrape.js     # Core Playwright logic per stack
│   └── upsert.js     # Supabase upsert logic
├── app/              # Next.js App Router
│   ├── page.tsx      # Dashboard (4 tabs)
│   └── api/          # API routes for dashboard data
├── supabase/
│   └── schema.sql    # DB schema (see schema.sql)
└── AGENTS.md         # This file
```

## Stacks tracked
SAP · Salesforce · MERN · .NET · Java

## Scraper filters applied on every run
- Posted: today (past 24h)
- Location: United States + Remote
- Job type: Contract + Full-time
- Easy Apply: enabled only

## Schedule
Once daily, morning. Triggered by pg_cron or a Supabase Edge Function.

## LinkedIn session cookie
- Extracted from a logged-in LinkedIn Premium browser session
- Stored in Supabase Vault (not env vars or code)
- Needs manual refresh every ~30–90 days

## Implementation build order
1. Supabase schema (run schema.sql)
2. Playwright scraper — single stack proof of concept (SAP first)
3. Supabase upsert logic — dedup by `linkedin_job_id`
4. Next.js scaffold — connect to Supabase, show raw job feed
5. Trend chart (Tab 1) — after a few days of data exist
6. Company map + competition table (Tabs 2–3)
7. Daily scheduler — pg_cron or Edge Function
8. Cookie management + error alerting

## Open decisions
- [ ] Where is the Playwright scraper hosted? (VPS, Railway, Render, or local for now)
- [ ] Where is Supabase self-hosted? (local Docker for dev, VPS for prod)
- [ ] Cookie refresh workflow — manual upload to Supabase Vault?
- [ ] Failure notification — email, Discord webhook, or dashboard status only?
- [ ] Additional stacks to track beyond the 5? (Python, React, AWS, etc.)

## Important note
Scraping LinkedIn violates their ToS. Use a dedicated secondary account for scraping — not your personal/main LinkedIn account.
