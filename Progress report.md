# Mavericks Market Intelligence: Progress Report

**Period:** 27 October – 2 November 2026
**Live dashboard:** https://jobs.mavericksunited.co
**Automation (n8n):** https://n8n.mavericksunited.co
**Code:** https://github.com/AliSajidZafar/Job-Scrapper (branch `main`)

---

## 1. What the product does

Mavericks Market Intelligence tracks US remote demand for **ten tech stacks** on LinkedIn: **SAP, Salesforce, MERN, .NET, Java, ServiceNow, Workday, Data Engineering, DevOps and AI / ML**. Every day it collects new remote job postings (posted in the last 24 hours, Contract or Full-time, Easy Apply). It records how many open roles each stack has and how many people applied to each job. All of this is shown on a public dashboard so you can see which stacks are rising, which are falling, and where competition is lowest.

It only reads job information. It never applies to jobs.

---

## 2. Summary of what is done

| Area | Status |
|---|---|
| Database (Supabase) | ✅ Live, hosted |
| LinkedIn scraper | ✅ Working, runs automatically every day |
| Dashboard (website) | ✅ Live on your own domain |
| Branding and design | ✅ Mavericks logo, light and dark mode |
| Accounts (sign up / sign in) | ✅ Live |
| Private admin area | ✅ Live, admin account "Mavericks" |
| Hosting on your VPS | ✅ Running 24/7, restarts by itself after a reboot |
| Custom domain + HTTPS | ✅ jobs.mavericksunited.co via Cloudflare |
| Daily automation + email alerts | ✅ n8n on the VPS, alerts to your Gmail |
| Ten tech stacks tracked | ✅ 5 original + 5 new (ServiceNow, Workday, Data Engineering, DevOps, AI / ML) |
| Movers & Opportunities views | ✅ Rising/falling stacks; low-competition and fastest-filling jobs |
| Professional account menu | ✅ Avatar dropdown when signed in; clear sign-in buttons when out |

**Data so far:** all 10 stacks carry live data. Latest full run 2 Nov captured 92 jobs across the 10 stacks, on top of the earlier runs (27–30 Oct). The dashboard refreshes with each scrape.

---

## 3. Day by day

### Day 1 (27 Oct): Foundation
- Studied your four spec files (CLAUDE.md, REQUIREMENTS.md, IMPLEMENTATION_PLAN.md, schema.sql) and reviewed them. I found a few gaps: an index bug in the schema, inconsistent tab numbering, and a 200-jobs-per-day cap that hides real demand.
- **Built the project from scratch:** a Next.js website (TypeScript), a scraper (Playwright, Node.js) and a database schema.
- **Built two improvements you picked from my suggestions:**
  - **True demand signal.** Records LinkedIn's total result count for each stack (for example, "2,000+ open roles for SAP"), not just the jobs we capture.
  - **Applicant snapshots.** Records each job's applicant count every day, so we can measure **applicants per hour**, which shows how fast competition builds.
- **Set up Supabase** (hosted database) with your keys and ran the migration.
- **First scrape:** LinkedIn served its public job pages rather than the logged-in ones, so I rewrote the scraper to read that public layout. **Result: 100 jobs** with applicant counts.

### Day 2 (28 Oct): Dashboard and branding
- Renamed the product to **Mavericks Market Intelligence** and added your **company logo**.
- Added the **"Market at a glance"** section to the main screen, with open roles, jobs tracked, and average and top applicant counts for every stack.
- Added **total applicants** across all stacks to the top-right summary strip.
- Fixed the **trend chart** so it draws a line per stack, with hover details.
- Added **dark mode**, with a toggle that remembers your choice.
- Applied a consistent, accessible colour palette (one colour per stack).
- Second scrape: **101 jobs**, giving two days of trend data.

### Day 3 (30 Oct): Going live
- **Deployed to your OVH VPS (51.75.72.98).**
  - The `ali` account has no admin (root) rights, so everything was installed without them (Node.js, a process manager, auto-restart on reboot).
  - Port 3000 was already used by another app on that server, so the dashboard runs on port 3001.
- **Public HTTPS without opening firewall ports.**
  - A Cloudflare Tunnel links the VPS to the internet.
  - You moved mavericksunited.co to a free Cloudflare account. I carried over and verified your GoDaddy email records, so email keeps working.
  - The dashboard is live at **https://jobs.mavericksunited.co**.
- **Accounts:**
  - **Create account** and **Sign in** pages. Anyone can register and sign in, and the dashboard stays public.
  - **Admin account "Mavericks"** (admin@mavericksunited.co). The password was generated securely and saved only on your PC, in `Mavericks-admin-login.txt` in your user folder.
  - A **private admin page** (/admin) with system status, scrape run history, the list of registered users, and tools such as CSV export.
  - **Security:** passwords are stored hashed by Supabase, sessions use signed cookies that can't be tampered with, and repeated wrong passwords and spam sign-ups are blocked. 19 automated security checks passed.
- **Daily scrape automation:**
  - **Tested running the scraper on the VPS.** LinkedIn blocks data-center servers, and it signed out the LinkedIn account within minutes of it being used there. So the scraper runs from **your PC**, where LinkedIn allows it **without any login**. Your LinkedIn account is no longer used at all.
  - **Windows runs the scrape every day at 7:00 PM PKT.** It wakes the PC if it's asleep, and catches up if the PC was off.
  - **n8n** (automation tool) is installed on the VPS at https://n8n.mavericksunited.co, under your own n8n login.
    - **After each run:** the scraper reports to n8n, and n8n **emails you if a run fails**.
    - **At 9:00 PM:** n8n checks that a run happened and **emails you if it didn't**, for example when the PC was off.
  - A test alert was sent successfully to alizafar38a@gmail.com.

---

### Day 3, evening (30 Oct): New look and new insights
- **Redesigned the Sign in and Create account pages.**
  - Large screens get a split layout with a brand panel showing live market numbers.
  - Field icons and a show/hide password button.
  - A password strength meter and clearer error messages.
  - Works in light mode, dark mode and on phones.
- **Redesigned the Admin page.**
  - A health banner (green, amber or red) and the time of the next scheduled scrape.
  - Key figures, a chart of jobs saved per run, and an automation panel with links to n8n.
  - A "Market by stack" table and a richer users list.
- **New: Movers.** The main screen shows which stack is rising most and which is falling most, and each stack tile shows its change since the previous scrape day. A weekly change is added once 7 days of data exist.
- **New: Opportunities tab.**
  - **Low-competition jobs:** fresh jobs with few applicants, filterable by 10, 25, 50 or 100 or fewer, each linked to LinkedIn so you can apply early.
  - **Filling fastest:** jobs gaining applicants quickest (applicants per hour between scrapes).
- All 19 security checks pass on the live site after these changes.

### Day 3, later (30 Oct): Ten tech stacks
- Researched the US IT staffing market and, with you, added **five new stacks** alongside the original five: **ServiceNow, Workday, Data Engineering, DevOps and AI / ML**.
- Gave each stack its own colour, checked for colour-blind readability in both light and dark mode (ten distinct, accessible colours).
- Rebuilt the main screen, trend chart, filters and company map to handle ten stacks cleanly; new stacks showed a **"Soon"** badge until their first scrape.
- Updated the database to allow the new stack names, and deployed it all live.

### Day 4 (2 Nov): Real data for all ten stacks + polish
- **Filled the five new stacks with real jobs.** The weekend runs had been missed (PC off), and that evening LinkedIn's job pages were unusually slow, which left the scheduled run crawling. I cleared it and ran a **catch-up scrape of all ten stacks — 92 jobs**, so every stack now shows live open-role totals, applicant averages and opportunities.
- **A proper account section.** Signed out, the header shows clear **Sign in** and **Create account** buttons; signed in, a professional **avatar menu** with your name, role, an Admin link (admins only) and Sign out — not loose text links.
- **A higher-quality dark-mode toggle** — a clean filled crescent moon and a solid sun, replacing the thin earlier icons.
- Added a safety control so a one-off catch-up run can use a smaller per-stack cap when LinkedIn is slow; the nightly run keeps its normal size.
- All 19 security checks still pass on the live site.

---

## 4. How it fits together

```
 Your PC (7 PM daily)                 Supabase (database)          Your VPS
 ┌────────────────────┐   saves jobs   ┌──────────────┐   reads   ┌──────────────────────┐
 │ LinkedIn scraper   │ ─────────────► │ jobs, counts │ ◄──────── │ Dashboard  (port 3001)│──► jobs.mavericksunited.co
 │ (guest, no login)  │                │ runs, users  │           │ n8n        (port 5678)│──► n8n.mavericksunited.co
 └────────┬───────────┘                └──────────────┘           └──────────┬───────────┘
          │ "run finished: success / failed"                                 │
          └──────────────────────────────────────────────────────────────────┘
                                                      n8n emails you on failure / missed run
```

---

## 5. What you need to know

- **Keep the PC on (and signed in to Windows) at 7 PM.** If it's off, the run happens when you next turn it on, and n8n emails you at 9 PM.
- **Admin password:** `C:\Users\Mavericks United\Mavericks-admin-login.txt`. To reset it, ask me.
- **Secrets** (database keys, session secret, webhook address) live only in `.env.local` on your PC and the VPS, never on GitHub.
- **Manual scrape at any time:** run `npm run scrape` in the project folder.
- **"Open roles" vs "Tracked" on each stack tile:** *open roles* is LinkedIn's total count of matching jobs (the size of the market); *tracked* is how many individual postings we pull in detail and follow over time (the sample we re-check for applicant growth).

---

## 6. Known gaps and open items

| Item | Notes |
|---|---|
| MERN and Workday find few jobs | Their keyword matching is too strict (MERN 1, Workday ~4 per run). Both need smarter matching (e.g. MERN = React + Node; Workday title variants). |
| Nightly run can be slow | With ten stacks at 25 jobs each, a slow LinkedIn evening can push a full run past an hour. Options: trim the per-stack cap, or speed up the applicant-count step. |
| Keep the PC on at 7 PM | The scrape runs on your PC; weekend runs were missed because it was off. n8n emails you when a run is missed. |
| No email verification on sign-up | Accounts are created instantly. Can be added with your GoDaddy mailbox. |
| Company names not normalised | For example, "Accenture" and "Accenture Federal" count as separate companies. |
| Easy-Apply-only filter | Hides jobs without Easy Apply, which undercounts real demand. Your decision whether to keep it. |
| Supabase public sign-up switch | Recommended: turn off "Allow new users to sign up" in Supabase (our own sign-up page keeps working). |

---

## 7. Next phase (options)

**Front-end polish (planned next, 3 Nov):** an executive KPI band across the top; a small trend sparkline in each stack tile; refined tabs with icons; trend-chart gradient fills and a clickable legend; a typography and spacing pass; a proper footer; and small interaction touches. Recommended first: the KPI band, sparklines and trend-chart polish.

**Other options:**
1. **Specialisations inside stacks:** split each stack into sub-skills from job titles (e.g. SAP S/4HANA, FICO, ABAP; Salesforce Admin, Developer, CPQ), and improve MERN/Workday matching.
2. **Weekly email digest:** n8n emails a Monday summary with top movers, the best low-competition jobs and the top hiring companies.
3. **Scale up:** raise the scrape toward more jobs per stack (balanced against run time).
4. **Email verification** for new sign-ups.
