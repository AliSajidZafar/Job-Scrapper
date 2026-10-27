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
  console.log("2. Once you see your feed, come back here and press Enter.\n");

  await new Promise((resolve) => process.stdin.once("data", resolve));

  await context.storageState({ path: outPath });
  console.log(`✓ Session saved to ${outPath}`);
  await browser.close();
  process.exit(0);
})();
