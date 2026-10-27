# Requirements — LinkedIn Job Market Intelligence Tool

## Goal
Scrape LinkedIn job postings daily to answer: **which tech stacks are rising or falling in demand this week**, measured by new job count and applicant competition across the US market.

This is a **data scraping and intelligence tool only** — no auto-applying, no form submission.

---

## Stacks tracked
| Stack | Notes |
|---|---|
| SAP | Primary stack of interest |
| Salesforce | Secondary |
| MERN | MongoDB, Express, React, Node |
| .NET | Microsoft stack |
| Java | All Java-based roles |

---

## Scraper filters (applied on every run)
| Filter | Value |
|---|---|
| Date posted | Today (past 24h) |
| Location | United States + Remote |
| Job type | Contract + Full-time |
| Easy Apply | On (Easy Apply only) |

---

## Data collected per job
| Field | Source |
|---|---|
| LinkedIn job ID | URL / page element (dedup key) |
| Job title | Job card |
| Company | Job card |
| Location | Job card |
| Job type | Filter result |
| Easy Apply flag | Filter result |
| Applicant count | Job detail page |
| Date posted | Job card |

---

## Dashboard — four views

### 1. Tech Stack Trend Chart
- Line chart: x = date, y = job count, one line per stack
- Default: last 30 days, all stacks visible
- Answers: is SAP up or down this week vs last?

### 2. Applicant Competition Table
- One row per job, sorted by applicant count descending
- Columns: Title · Company · Stack · Location · Applicants · Posted
- High count = crowded; low count = early opportunity

### 3. Company Stack Map
- One row per company, columns = each stack
- Cell = number of open roles for that stack at that company
- Use to find companies hiring SAP but not MERN, etc.
- Filter to hide stacks you don't care about

### 4. Raw Job Feed
- Full filterable table of all jobs scraped
- Columns: Title · Company · Stack(s) · Location · Type · Easy Apply · Applicants · Date
- Default sort: most recent first
- Export to CSV (nice-to-have)

---

## Global UI filters
- Tech stack (multi-select)
- Date range (default: today)
- Job type: Contract / Full-time
- Location: US / Remote
- Easy Apply: yes/no

---

## Scraper schedule
Once daily, morning (exact time TBD). Triggered by pg_cron via Supabase.

---

## Authentication
LinkedIn Premium session cookie. Stored in Supabase Vault. Needs manual refresh every ~30–90 days.

---

## Rate limiting & safety
- Random delays 2–5 seconds between page loads
- Max ~200 jobs per stack per run
- On failure: log to `scrape_runs`, send notification, skip remaining stacks
- Never run more than once per day from the same account
- **Use a dedicated secondary LinkedIn account, not your personal one**
