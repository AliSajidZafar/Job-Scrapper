// Core Playwright scraping logic for a single stack.
//
// LinkedIn serves the PUBLIC (guest) job-search layout for these URLs, so we
// parse the guest card structure (.base-search-card under
// ul.jobs-search__results-list). The list card gives title/company/location/
// job id/posted date; the applicant count lives on the job detail page
// (figcaption.num-applicants__caption), which we fetch per job.
//
// Scraping LinkedIn violates their ToS — use a dedicated secondary account.

const config = require("./config");

const BASE = "https://www.linkedin.com";

const SELECTORS = {
  jobCard: "ul.jobs-search__results-list > li",
  resultsCount: ".results-context-header__job-count",
  seeMore: "button.infinite-scroller__show-more-button, button[aria-label='See more jobs']",
  // On the job detail page:
  applicants: "figcaption.num-applicants__caption, .num-applicants__caption",
};

function randomDelay([min, max]) {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((r) => setTimeout(r, ms));
}

// Human-facing search URL. Filters: f_TPR=r86400 (24h), f_JT=C,F (contract +
// full-time), f_AL=true (Easy Apply), f_WT=2 (Remote), sortBy=DD (most recent).
function buildSearchUrl(stack) {
  const f = config.filters;
  const params = new URLSearchParams({
    keywords: stack.query,
    location: f.location,
    f_TPR: "r86400",
    sortBy: "DD",
  });
  if (f.jobTypes?.length) {
    params.set("f_JT", f.jobTypes.map((t) => (t === "contract" ? "C" : "F")).join(","));
  }
  if (f.easyApplyOnly) params.set("f_AL", "true");
  if (f.remote) params.set("f_WT", "2");
  return `${BASE}/jobs/search/?${params.toString()}`;
}

function parseApplicantCount(text) {
  if (!text) return null;
  // "Over 200 applicants" -> 200 ; "Be among the first 25 applicants" -> 25 ; "47 applicants" -> 47
  const m = text.replace(/,/g, "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// Pull the result total from the page <title> ("... (1,000+ Open Roles)") first
// — most reliable — then fall back to the on-page results header text.
function parseResultsCount(text) {
  if (!text) return null;
  const roles = text.match(/\(([\d,]+)\+?\s*Open Roles\)/i);
  const m = (roles ? roles[1] : text).replace(/,/g, "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function stackMatches(stack, title, description) {
  const haystack = `${title} ${description || ""}`;
  return stack.match.some((re) => re.test(haystack));
}

async function textOf(scope, selector) {
  const el = await scope.$(selector);
  if (!el) return "";
  return ((await el.textContent()) || "").trim();
}

// Read every currently-rendered guest card into plain objects.
async function readCards(page) {
  return page.$$eval(SELECTORS.jobCard, (lis) =>
    lis.map((li) => {
      const base = li.querySelector(".base-card");
      const urn = base ? base.getAttribute("data-entity-urn") || "" : "";
      const idMatch = urn.match(/(\d+)/);
      const time = li.querySelector("time");
      const text = (sel) => {
        const n = li.querySelector(sel);
        return n ? n.textContent.trim() : "";
      };
      return {
        linkedin_job_id: idMatch ? idMatch[1] : null,
        title: text(".base-search-card__title"),
        company: text(".base-search-card__subtitle"),
        location: text(".job-search-card__location"),
        posted_at: time ? time.getAttribute("datetime") : null,
      };
    }),
  );
}

// Scrape one stack. Returns { jobs, totalResults }.
async function scrapeStack(page, stack) {
  const url = buildSearchUrl(stack);
  console.log(`  → ${stack.name}: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await randomDelay(config.limits.pageDelayMs);

  // Auth wall / checkpoint is fatal — let the caller abort the run.
  if (/authwall|checkpoint|\/login/.test(page.url())) {
    throw new AuthError(`Redirected to ${page.url()} — session is invalid.`);
  }

  // Demand total (suggestion #2): prefer the title, fall back to the header.
  const totalResults =
    parseResultsCount(await page.title()) ??
    parseResultsCount(await textOf(page, SELECTORS.resultsCount));

  // Collect cards, loading more until we hit the cap or the list stops growing.
  const cap = config.limits.maxJobsPerStack;
  const byId = new Map();
  let stagnant = 0;

  while (byId.size < cap) {
    for (const c of await readCards(page)) {
      if (byId.size >= cap) break;
      if (!c.linkedin_job_id || byId.has(c.linkedin_job_id)) continue;
      if (!stackMatches(stack, c.title)) continue; // keyword noise filter
      byId.set(c.linkedin_job_id, c);
    }
    if (byId.size >= cap) break;

    const before = (await page.$$(SELECTORS.jobCard)).length;
    const moreBtn = await page.$(SELECTORS.seeMore);
    if (moreBtn) await moreBtn.click().catch(() => null);
    else await page.mouse.wheel(0, 4000);
    await randomDelay(config.limits.pageDelayMs);
    const after = (await page.$$(SELECTORS.jobCard)).length;

    if (after <= before) {
      if (++stagnant >= 2) break; // list stopped growing
    } else {
      stagnant = 0;
    }
  }

  const jobs = [...byId.values()].map((j) => ({
    ...j,
    easy_apply: config.filters.easyApplyOnly,
    job_type: null, // both types selected in one search — not distinguishable here
    applicant_count: null,
    stack: stack.name,
  }));

  // Applicant count per job (suggestion #3 feeds off this), from detail pages.
  if (config.limits.fetchApplicantCounts !== false) {
    for (const job of jobs) {
      try {
        await page.goto(`${BASE}/jobs/view/${job.linkedin_job_id}`, {
          waitUntil: "domcontentloaded",
        });
        await randomDelay(config.limits.pageDelayMs);
        job.applicant_count = parseApplicantCount(await textOf(page, SELECTORS.applicants));
      } catch {
        // leave applicant_count null on a failed detail load
      }
    }
  }

  console.log(
    `    ✓ ${stack.name}: ${jobs.length} jobs captured` +
      (totalResults != null ? ` of ${totalResults} total results` : ""),
  );
  return { jobs, totalResults };
}

// Thrown on auth-wall / checkpoint so index.js can stop the whole run.
class AuthError extends Error {}

module.exports = {
  scrapeStack,
  buildSearchUrl,
  parseApplicantCount,
  parseResultsCount,
  AuthError,
};
