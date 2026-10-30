# Mavericks Market Intelligence: Progress Report

**Period:** 27–30 October 2026
**Live dashboard:** https://jobs.mavericksunited.co
**Automation (n8n):** https://n8n.mavericksunited.co
**Code:** https://github.com/AliSajidZafar/Job-Scrapper (branch `main`)

---

## 1. What the product does

Mavericks Market Intelligence tracks US demand for five tech stacks on LinkedIn: **SAP, Salesforce, MERN, .NET and Java**. Every day it collects new remote job postings (posted in the last 24 hours, Contract or Full-time, Easy Apply). It records how many open roles each stack has and how many people applied to each job. All of this is shown on a public dashboard so you can see which stacks are rising, which are falling, and where competition is lowest.

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

**Data so far:** 163 unique jobs, 201 applicant-count readings and 15 daily demand totals, from 3 scrape runs (27–28 Oct). The first fully automatic run is 30 Oct at 7 PM PKT.

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

---

## 6. Known gaps and open items

| Item | Notes |
|---|---|
| MERN finds very few jobs | The search needs the literal word "MERN" in the title, so it only catches 1–2 jobs per run. Needs smarter matching (e.g. React + Node). |
| 25 jobs per stack per run | Kept low for testing. Can be raised toward about 200, at roughly 1 hour per run. |
| No email verification on sign-up | Accounts are created instantly. Can be added with your GoDaddy mailbox. |
| Company names not normalised | For example, "Accenture" and "Accenture Federal" count as separate companies. |
| Easy-Apply-only filter | Hides jobs without Easy Apply, which undercounts real demand. Your decision whether to keep it. |
| Supabase public sign-up switch | Recommended: turn off "Allow new users to sign up" in Supabase (our own sign-up page keeps working). |

---

## 7. Next phase (planned)

1. **New market-intelligence features:** options are being proposed for you to choose from.
2. **Redesign the Sign in, Create account and Admin pages** to match the dashboard's look.
