# Mavericks Market Intelligence: Progress Report

**Period:** 27 October – 13 November 2026
**Live dashboard:** https://jobs.mavericksunited.co
**Automation (n8n):** https://n8n.mavericksunited.co
**Code:** https://github.com/AliSajidZafar/Job-Scrapper (branch `main`)
**Project folder (on your PC):** `C:\Users\Mavericks United\Documents\Mavericks\Job Scrapper` (moved out of OneDrive on 10 Nov — see Day 7)

---

## 1. What the product does

Mavericks Market Intelligence tracks US remote demand for **twenty tech stacks** on LinkedIn: the ten core stacks — **SAP, Salesforce, MERN, .NET, Java, ServiceNow, Workday, Data Engineering, DevOps and AI / ML** — plus ten specialist, low-competition stacks — **Rust, Elixir, C++, Haskell, SRE, Embedded, GIS, COBOL, CUDA and Edge AI**. Every day it collects new remote job postings (posted in the last 24 hours, Contract or Full-time, Easy Apply). It records how many open roles each stack has and how many people applied to each job. All of this is shown on a public dashboard so you can see which stacks are rising, which are falling, and where competition is lowest.

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
| Twenty tech stacks tracked | ✅ 10 core + 10 specialist (Rust, Elixir, C++, Haskell, SRE, Embedded, GIS, COBOL, CUDA, Edge AI) |
| Movers & Opportunities views | ✅ Rising/falling stacks; low-competition and fastest-filling jobs |
| Professional account menu | ✅ Avatar dropdown when signed in; clear sign-in buttons when out |
| Executive dashboard polish | ✅ KPI band, per-stack sparklines, focusable trend chart (3 Nov) |
| Mobile layout | ✅ Tuned for phones |
| Time-range filter | ✅ "Period" filter (All / Latest / 7 / 30 / 90 days) |
| Dashboard number accuracy | ✅ Headline counts fixed to read all records (10 Nov) |
| Credentials scrubbed from GitHub | ✅ Old password files erased from all history; ignore rules hardened (10 Nov) |
| Project moved off OneDrive | ✅ Now in a normal folder to stop file-sync corruption (10 Nov) |
| Period filter shows true totals | ✅ Fixed 500-row cap; tables now page (13 Nov) |
| Live applicant refresh | ✅ Per-job ↻ button fetches the current count from LinkedIn on demand (13 Nov) |
| Company intelligence | ✅ Click a company for its full hiring breakdown (13 Nov) |

**Data so far:** all 20 stacks carry live data. The latest run (9 Nov) and earlier runs add up to **1,692 tracked postings** and about **98,440 recorded applicants** across the stacks. The dashboard refreshes with each scrape.

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
  - **Admin account "Mavericks"** (kaleem@maverickslabs.io). The password remains unchanged and is saved only on your PC, in `Mavericks-admin-login.txt` in your user folder.
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

### Day 5 (3 Nov): Executive polish
- **Executive KPI band.** A headline row across the top — open roles, jobs tracked, total applicants and average applicants — as clean stat cards, each with a colour accent and an icon, and (for open roles) a market-wide trend sparkline plus a day-over-day change.
- **Per-stack sparklines.** Every stack tile now shows a small trend line in its own colour, so you can read each stack's direction at a glance. New stacks show a faint placeholder line until they have a few days of history.
- **Focusable trend chart.** The chart legend is now interactive: click any stack to isolate it, which reveals a soft gradient fill under its line; click it again to bring all ten back. With every stack shown it stays as clean lines (fills would overlap into mud).
- Checked in light mode, dark mode and on phones; the production build is clean and all 19 security checks still pass on the live site. **Deployed to https://jobs.mavericksunited.co.**

### Day 6 (9 Nov): Twenty stacks, mobile polish, and a big data run
- **Doubled the tracked stacks from ten to twenty.** Added ten specialist, low-competition, high-skill markets: **Rust, Elixir, C++, Haskell, SRE, Embedded, GIS, COBOL, CUDA and Edge AI**. Each got its own colour and was wired through the dashboard, trend chart, filters and company map, and added to the database.
- **Mobile layout pass** so the dashboard reads cleanly on a phone, and a new **time-range ("Period") filter** so you can view All, the Latest run, or the last 7 / 30 / 90 days.
- **Tidied up the main dashboard code** (a behind-the-scenes refactor) with no change to how it looks.
- **Ran a full scrape across all stacks — 438 jobs** — and confirmed it finished successfully, so every stack carries fresh data. One stack (SAP) came back empty on the first attempt due to a cold-start hiccup on LinkedIn's first page; a re-run captured it normally.
- **Admin account updated.** You changed the admin email in Supabase to **kaleem@maverickslabs.io**; I reset the password at your request and verified sign-in works end to end (the old password no longer works). The new login is saved only on your PC, in `Mavericks-admin-login.txt` — not written here, since this report is in the public code repository.

### Day 7 (10 Nov): Accurate numbers, a security cleanup, and off OneDrive
- **Renamed the date filter heading to "Period"** so it reads naturally over the All / Latest / 7 / 30 / 90-day tabs.
- **Fixed a real accuracy bug in the headline numbers.** The database returns at most 1,000 records per request, and the dashboard code wasn't reading past the first page — so **"Jobs tracked" was stuck at exactly 1,000** and **"Total applicants" was undercounted**, and the number on a stack tile was lower than the number shown when you clicked into that stack. I made it read every record. The numbers are now correct and consistent: **1,692 tracked postings** and about **98,440 applicants**, and each tile matches its detail view exactly. The CSV export had the same cap and was quietly dropping about 700 jobs — fixed too.
  - For context: the data is a **once-a-day snapshot** — accurate as of the nightly scrape, not second-by-second live. (I checked one job: we had 108 applicants stored; LinkedIn showed 109 at the time, one more than when we last looked.) You chose to keep the nightly schedule.
- **Security: cleaned up exposed passwords in the code history.** A few small files that held passwords had, in the past, been committed to the public code repository. They were already out of the current code, but they were still readable in the repository's history. I **rewrote the entire history to erase them** and confirmed they now return "not found" on GitHub, and I **strengthened the ignore rules** so no password, key or secret file can be committed again. Your main secrets (database keys and the session secret) were **never exposed** — they live only in a local settings file that was never uploaded. *(You chose not to change the exposed passwords; if you ever want to, resetting the Supabase database password is the one that matters.)*
- **Moved the whole project out of OneDrive.** The project had been sitting in a OneDrive-synced folder, and OneDrive kept interfering with the behind-the-scenes version-control data — it corrupted the repository twice in one sitting. I moved everything to a normal folder, **`C:\Users\Mavericks United\Documents\Mavericks\Job Scrapper`**, reinstalled everything, confirmed it builds and runs, carried over your private settings and the LinkedIn session file, and **repointed the 7 PM scheduled scrape** to the new location. The old OneDrive copy has been removed. This stops the corruption from happening again.

### Day 8 (13 Nov): Period fix, live refresh, and company intelligence
- **Fixed the Period (time-range) filter.** The job lists were quietly capped at 500 rows, so **All, 7 days, 30 days and 90 days all showed 500** regardless of the real total. And "Latest" meant "the last 24 hours by the clock", which would show nothing after a missed day. Now every period returns the true count (All = 2,405, 7 days = 1,381, and so on), "Latest" means the jobs from the most recent scrape run, and the Competition and Raw Feed tables **page 50 at a time** with a "Showing 1–50 of 2,405" line. The other tabs show a short note that Period applies only to those two lists.
- **Live applicant refresh — the closest thing to "matches LinkedIn right now".** Because the data is a daily snapshot, applicant counts drift during the day. Every job (in the stack and company drill-downs) now has a small **↻ refresh button**: click it and the site fetches *that one job's* current applicant count straight from LinkedIn and updates it, showing "✓ live · just now". It is a single, you-initiated request — polite, not bulk automation — and only works on jobs we already track. (Example seen on the day: a role stored at 139 applicants was 194 live.)
- **Company intelligence page.** In the **Company Map** tab, company names are now clickable. Clicking one opens a panel showing how many roles that company is hiring, which stacks they hire for (with a breakdown bar), their applicant competition (average / median / most), the experience-level split, and the full list of their postings — each with its own live-refresh button. (Example: Deloitte — 179 roles across 11 stacks.)
- All of the above is built, deployed and live. The data endpoints were verified against the live site; the on-screen panels sit behind sign-in, so please click a company and try the ↻ button once when you're logged in.

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
- **Project folder moved (10 Nov):** it is now `C:\Users\Mavericks United\Documents\Mavericks\Job Scrapper`, outside OneDrive. Don't move it back into OneDrive — that corrupted the project's internal data twice.
- **Secrets** (database keys, session secret, webhook address) live only in `.env.local` on your PC and the VPS, never on GitHub.
- **Manual scrape at any time:** open the project folder (above) and run `npm run scrape`.
- **"Open roles" vs "Tracked" on each stack tile:** *open roles* is LinkedIn's total count of matching jobs (the size of the market); *tracked* is how many individual postings we pull in detail and follow over time (the sample we re-check for applicant growth).
- **The "Period" filter** (All / Latest / 7 / 30 / 90 days) only changes the **Competition** and **Raw Feed** job lists. The top tiles, Trend chart, Opportunities and Company Map are not affected. 30 and 90 days currently equal All because all data so far is under a month old.
- **The ↻ live-refresh button** updates one job's applicant count against LinkedIn in that moment — use it on roles you care about. The rest of the numbers refresh with the nightly scrape.

---

## 6. Known gaps and open items

| Item | Notes |
|---|---|
| MERN and Workday find few jobs | Their keyword matching is too strict (MERN 1, Workday ~4 per run). Both need smarter matching (e.g. MERN = React + Node; Workday title variants). |
| Nightly run can be slow | With twenty stacks at 15 jobs each, a slow LinkedIn evening can push a full run past an hour. Options: trim the per-stack cap, or speed up the applicant-count step. |
| Keep the PC on at 7 PM | The scrape runs on your PC; weekend runs were missed because it was off. n8n emails you when a run is missed. |
| No email verification on sign-up | Accounts are created instantly. Can be added with your GoDaddy mailbox. |
| Company names not normalised | For example, "Accenture" and "Accenture Federal" count as separate companies. |
| Easy-Apply-only filter | Hides jobs without Easy Apply, which undercounts real demand. Your decision whether to keep it. |
| Supabase public sign-up switch | Recommended: turn off "Allow new users to sign up" in Supabase (our own sign-up page keeps working). |
| Some specialist stacks find few jobs | The rarer markets (e.g. Haskell, Elixir, COBOL) naturally return few postings; this is partly real scarcity and partly keyword matching that can still be tuned. |
| Exposed passwords not reset | The password files were erased from the code history, but they had been public for about two weeks. You chose not to change the passwords. If reconsidered, resetting the Supabase **database** password is the one that matters (it won't affect the website). |
| Data is a daily snapshot, not live | Numbers are accurate as of the nightly scrape and drift during the day as people apply. Making it truly live isn't practical with LinkedIn and isn't recommended. |

---

## 7. Next phase (options)

**Done since the last report:** the **company intelligence page** and the **on-demand live refresh** (the closest practical answer to "match LinkedIn in real time") are both built and live (see Day 8). Front-end polish first round is also done (see Day 5).

**Still open (your pick next):**
1. **Specialisations inside stacks:** split each stack into sub-skills from job titles (e.g. SAP S/4HANA, FICO, ABAP; Salesforce Admin, Developer, CPQ), and improve MERN/Workday matching.
2. **Weekly email digest:** n8n emails a Monday summary with top movers, the best low-competition jobs and the top hiring companies.
3. **Saved searches + alerts:** follow a stack or filter and get emailed when a fresh low-competition job appears.
4. **Scrape more often** (e.g. 2–3×/day) so the baseline data is never more than a few hours old.
5. **Email verification** for new sign-ups; **company-name normalisation**; refined tabs/typography/footer polish.
