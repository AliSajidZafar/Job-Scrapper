// Core Playwright scraping logic for a single stack.
// Builds a filtered LinkedIn job search, paginates, and pulls applicant counts.
//
// NOTE: LinkedIn's DOM changes often. The selectors below are a starting point
// (the SAP proof-of-concept from the implementation plan); expect to adjust the
// `SELECTORS` block when a run returns 0 jobs. Scraping LinkedIn violates their
// ToS — use a dedicated secondary account, never your personal one.

const config = require("./config");

const SELECTORS = {
  jobCard: ".job-card-container, .jobs-search-results__list-item",
  jobTitle: ".job-card-list__title, .job-card-container__link",
  company: ".job-card-container__primary-description, .artdeco-entity-lockup__subtitle",
  location: ".job-card-container__metadata-item",
  // Applicant count lives on the detail pane after clicking a card.
  applicants: ".jobs-unified-top-card__applicant-count, .tvm__text",
  nextPage: "button[aria-label='View next page']",
  // The "N results" header LinkedIn shows above the list (suggestion #2).
  resultsCount:
    ".jobs-search-results-list__subtitle, .results-context-header__job-count, small.jobs-search-results-list__text",
};

// Pick a random delay in [min, max] and sleep. Human-ish pacing.
function randomDelay([min, max]) {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((r) => setTimeout(r, ms));
}

// Map our filter config to LinkedIn's job-search URL query params.
// f_TPR=r86400 = posted in the last 24h; f_JT=C,F = contract + full-time;
// f_AL=true = Easy Apply; f_WT=2 = Remote workplace type.
function buildSearchUrl(stack) {
  const f = config.filters;
  const params = new URLSearchParams({
    keywords: stack.query,
    location: f.location,
    f_TPR: "r86400",
    sortBy: "DD", // most recent first
  });
  if (f.jobTypes?.length) {
    params.set(
      "f_JT",
      f.jobTypes.map((t) => (t === "contract" ? "C" : "F")).join(","),
    );
  }
  if (f.easyApplyOnly) params.set("f_AL", "true");
  if (f.remote) params.set("f_WT", "2");
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

function parseApplicantCount(text) {
  if (!text) return null;
  // "Over 100 applicants" -> 100 ; "27 applicants" -> 27
  const m = text.replace(/,/g, "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// "1,234 results" / "About 2,000 results" -> 1234 / 2000
function parseResultsCount(text) {
  if (!text) return null;
  const m = text.replace(/,/g, "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function stackMatches(stack, title, description) {
  const haystack = `${title} ${description || ""}`;
  return stack.match.some((re) => re.test(haystack));
}

// Scrape one stack. Returns an array of normalized job objects.
async function scrapeStack(page, stack) {
  const url = buildSearchUrl(stack);
  console.log(`  → ${stack.name}: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await randomDelay(config.limits.pageDelayMs);

  // Detect an auth wall / checkpoint early so the caller can abort the run.
  if (/authwall|checkpoint|login/.test(page.url())) {
    throw new AuthError(`Redirected to ${page.url()} — session cookie is invalid.`);
  }

  // Record LinkedIn's reported result total before we start paginating. This is
  // the demand signal that the per-stack cap can't flatten (suggestion #2).
  const totalResults = parseResultsCount(await textOf(page, SELECTORS.resultsCount));

  const jobs = [];
  const seen = new Set();

  while (jobs.length < config.limits.maxJobsPerStack) {
    await page.waitForSelector(SELECTORS.jobCard, { timeout: 15000 }).catch(() => null);
    const cards = await page.$$(SELECTORS.jobCard);
    if (cards.length === 0) break;

    for (const card of cards) {
      if (jobs.length >= config.limits.maxJobsPerStack) break;

      const linkedinJobId = await card
        .getAttribute("data-job-id")
        .catch(() => null);
      if (!linkedinJobId || seen.has(linkedinJobId)) continue;
      seen.add(linkedinJobId);

      const title = (await textOf(card, SELECTORS.jobTitle)).trim();
      const company = (await textOf(card, SELECTORS.company)).trim();
      const location = (await textOf(card, SELECTORS.location)).trim();

      // Open the detail pane to read the applicant count.
      await card.click().catch(() => null);
      await randomDelay(config.limits.pageDelayMs);
      const applicantText = await textOf(page, SELECTORS.applicants);
      const applicantCount = parseApplicantCount(applicantText);

      if (!stackMatches(stack, title)) continue; // keyword noise filter

      jobs.push({
        linkedin_job_id: linkedinJobId,
        title,
        company,
        location,
        applicant_count: applicantCount,
        easy_apply: config.filters.easyApplyOnly,
        posted_at: null, // parse from detail pane if you need exact dates
        stack: stack.name,
      });
    }

    const next = await page.$(SELECTORS.nextPage);
    if (!next) break;
    await next.click();
    await randomDelay(config.limits.pageDelayMs);
  }

  console.log(
    `    ✓ ${stack.name}: ${jobs.length} jobs captured` +
      (totalResults != null ? ` of ${totalResults} total results` : ""),
  );
  return { jobs, totalResults };
}

async function textOf(scope, selector) {
  const el = await scope.$(selector);
  if (!el) return "";
  return (await el.textContent()) || "";
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
