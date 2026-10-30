// One-time LinkedIn session capture.
// Opens a real browser, you log in to the SECONDARY account by hand, then this
// saves the session so the scraper can reuse it. Re-run every ~30–90 days.
//
// Usage:  node scraper/save-session.js
//
// Never use your personal/main LinkedIn account — scraping violates LinkedIn ToS.

const { chromium } = require("playwright");
const config = require("./config");

(async () => {
  const outPath = config.session.storageStatePath;
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://www.linkedin.com/login");
  console.log("\n1. Log in to your SECONDARY LinkedIn account in the window that opened.");
  console.log("2. The session saves by itself once your feed loads (or press Enter here).\n");

  // Save as soon as the feed is reached, so no terminal interaction is needed.
  const onFeed = page.waitForURL(/linkedin\.com\/feed/, { timeout: 15 * 60 * 1000 });
  const onEnter = new Promise((resolve) => process.stdin.once("data", resolve));
  await Promise.race([onFeed, onEnter]);
  await page.waitForTimeout(3000);

  await context.storageState({ path: outPath });
  console.log(`✓ Session saved to ${outPath}`);
  await browser.close();
  process.exit(0);
})();
