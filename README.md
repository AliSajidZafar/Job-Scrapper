# LinkedIn Job Market Intelligence Tool

Daily scrape of LinkedIn job postings → a dashboard that tracks which tech
stacks (**SAP · Salesforce · MERN · .NET · Java**) are rising or falling in US
demand, by new-job count and applicant competition. Data/intelligence only — no
auto-applying.

> ⚠️ Scraping LinkedIn violates their Terms of Service. Use a **dedicated
> secondary account**, never your personal/main one.

## Stack

- **Dashboard:** Next.js 16 (App Router, TypeScript, Tailwind v4)
- **Database:** Supabase / Postgres
- **Scraper:** Playwright (Node.js), config-driven

## Layout

```
app/
  page.tsx            # Dashboard shell
  api/                # Route handlers (dynamic — always read fresh)
    jobs/             #   raw feed + competition
    trend/            #   stack_trend view
    company-map/      #   company_stack_map view (pivoted server-side)
    status/           #   latest scrape_runs row
    export/           #   CSV download
components/
  Dashboard.tsx       # 4 tabs + global filters (client)
  TrendChart.tsx      # dependency-free SVG line chart
lib/
  supabase.ts         # server client (null when unconfigured)
  types.ts            # shared domain types
scraper/
  config.js           # stacks, filters, limits, pacing — tweak here
  scrape.js           # core Playwright logic per stack
  upsert.js           # Supabase upsert + run logging
  index.js            # entry point — `npm run scrape`
supabase/
  schema.sql          # canonical schema (run this)
schema.sql            # original design reference (kept as-authored)
```

## Setup

1. **Install**

   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Database** — run `supabase/schema.sql` in your Supabase SQL editor.

3. **Env** — copy `.env.example` to `.env.local` and fill in the Supabase URL,
   anon key, and service-role key.

4. **Capture a LinkedIn session** (once per ~30–90 days). On a machine with a
   browser, log in to the secondary account, then save `storageState`:

   ```js
   // save-session.js — run with: node save-session.js
   const { chromium } = require("playwright");
   (async () => {
     const b = await chromium.launch({ headless: false });
     const ctx = await b.newContext();
     const page = await ctx.newPage();
     await page.goto("https://www.linkedin.com/login");
     console.log("Log in, then press Enter here…");
     await new Promise((r) => process.stdin.once("data", r));
     await ctx.storageState({ path: "scraper/.linkedin-session.json" });
     await b.close();
   })();
   ```

5. **Scrape**

   ```bash
   npm run scrape
   ```

6. **Dashboard**

   ```bash
   npm run dev
   ```

## Notes on the data (read before trusting the numbers)

These are judgment calls baked into the current filters — revisit them in
`scraper/config.js`:

- **Easy-Apply-only biases demand.** Many SAP/enterprise roles are *not* Easy
  Apply, so the count undercounts them. Set `easyApplyOnly: false` to measure
  true demand; keep the `easy_apply` flag per job instead of filtering on it.
- **The 200/stack cap saturates big stacks** (Java, .NET), flattening the trend.
  Consider also recording LinkedIn's "N results" total per search.
- **Applicant count on <24h jobs is a tiny, capped snapshot** ("Over N"). A
  per-job snapshot table over time (applicants-per-hour) is more honest.
- **Keyword → stack is fuzzy** (".NET" tokenizes badly, "Java" catches
  "JavaScript"). `config.js` adds a post-fetch `match` regex per stack; tune it.
- **Recruiter reposts** get new IDs and company names aren't normalized, so the
  company map over-weights staffing firms.

## Scheduling

pg_cron / Edge Functions **cannot run Playwright** (Deno, short-lived, no
Chromium) — they can only *trigger* a host that can. Simplest: run
`npm run scrape` once each morning via Windows Task Scheduler (dev) or cron on
whatever box hosts the scraper (prod).
