// Scraper entry point. Runs every configured stack once, persists results,
// and logs the run. Invoke with `npm run scrape`.
//
// Requires a LinkedIn session saved as Playwright storageState JSON. See the
// README for how to capture one. Scraping LinkedIn violates their ToS — use a
// dedicated secondary account only.

require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const { chromium } = require("playwright");
const config = require("./config");
const { scrapeStack, AuthError } = require("./scrape");
const { upsertJobs, logRun, recordSearchSnapshot } = require("./upsert");

function randomDelay([min, max]) {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((r) => setTimeout(r, ms));
}

async function sendAlert(message) {
  if (!config.alertWebhookUrl) return;
  try {
    await fetch(config.alertWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `[job-scraper] ${message}` }),
    });
  } catch (e) {
    console.error("Alert webhook failed:", e.message);
  }
}

async function main() {
  const statePath = config.session.storageStatePath;
  if (!fs.existsSync(statePath)) {
    console.error(`No LinkedIn session at ${statePath}. See README → "Capture a session".`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: statePath,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  });
  const page = await context.newPage();

  let totalJobs = 0;
  let failedStacks = 0;
  let fatalError = null;

  for (const stack of config.stacks) {
    try {
      const { jobs, totalResults } = await scrapeStack(page, stack);
      totalJobs += await upsertJobs(jobs);
      // Demand total (suggestion #2) — logged even when the cap limits detail scraping.
      await recordSearchSnapshot({
        stack: stack.name,
        totalResults,
        scrapedCount: jobs.length,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        // Auth wall / checkpoint is fatal — stop the whole run.
        fatalError = err;
        break;
      }
      // A single stack's selector failure shouldn't abort the rest.
      console.error(`  ✗ ${stack.name} failed: ${err.message}`);
      failedStacks += 1;
    }
    await randomDelay(config.limits.stackDelayMs);
  }

  await browser.close();

  // Resolve a run status and log it.
  let status = "success";
  let message = null;
  if (fatalError) {
    status = "failed";
    message = fatalError.message;
  } else if (failedStacks > 0) {
    status = "partial";
    message = `${failedStacks} stack(s) failed`;
  }

  await logRun({ jobsFound: totalJobs, status, errorMessage: message });
  console.log(`\nRun ${status}: ${totalJobs} jobs across ${config.stacks.length} stacks.`);

  if (status !== "success") {
    await sendAlert(`Run ${status}: ${message}`);
    process.exit(status === "failed" ? 1 : 0);
  }
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  await logRun({ jobsFound: 0, status: "failed", errorMessage: err.message });
  await sendAlert(`Fatal: ${err.message}`);
  process.exit(1);
});
