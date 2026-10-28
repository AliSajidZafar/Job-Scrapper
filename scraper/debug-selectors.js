// Dev-only: load one logged-in job search and report which selectors match,
// so we can fix stale selectors in scrape.js. Run: node scraper/debug-selectors.js
require("dotenv").config({ path: ".env.local" });
const { chromium } = require("playwright");
const config = require("./config");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    storageState: config.session.storageStatePath,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  });
  const page = await ctx.newPage();
  const url =
    "https://www.linkedin.com/jobs/search/?keywords=Salesforce&location=United%20States&f_TPR=r86400&sortBy=DD&f_JT=C%2CF&f_AL=true&f_WT=2";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  console.log("URL:", page.url());
  console.log("TITLE:", await page.title());

  const probes = [
    "div.job-card-container",
    "li.scaffold-layout__list-item",
    "li.jobs-search-results__list-item",
    "[data-occludable-job-id]",
    "[data-job-id]",
    "ul.jobs-search__results-list > li",
    ".job-card-container__link",
    ".job-card-list__title--link",
    ".jobs-search-results-list__subtitle",
    ".results-context-header__job-count",
    "main ul > li",
  ];
  console.log("\n--- selector match counts ---");
  for (const sel of probes) {
    const n = await page.$$eval(sel, (els) => els.length).catch(() => "ERR");
    console.log(`${String(n).padStart(4)}  ${sel}`);
  }

  // Dump the first plausible card's tag/attrs/classes so we can pick a selector.
  const firstLi = await page.$(
    "[data-occludable-job-id], div.job-card-container, li.scaffold-layout__list-item, main ul > li",
  );
  if (firstLi) {
    const info = await firstLi.evaluate((el) => ({
      tag: el.tagName,
      attrs: Array.from(el.attributes).map((a) => `${a.name}="${a.value}"`),
      innerClasses: Array.from(el.querySelectorAll("*"))
        .slice(0, 40)
        .map((n) => `${n.tagName.toLowerCase()}.${(n.className || "").toString().split(" ").join(".")}`)
        .filter((c) => c.includes("job") || c.includes("title") || c.includes("company") || c.includes("entity")),
      html: el.outerHTML.slice(0, 1200),
    }));
    console.log("\n--- first card ---");
    console.log("TAG:", info.tag);
    console.log("ATTRS:", info.attrs.join(" "));
    console.log("INNER (job/title/company-ish):\n", info.innerClasses.join("\n"));
    console.log("HTML (truncated):\n", info.html);
  } else {
    const snippet = await page.evaluate(
      () => (document.querySelector("main") || document.body).innerHTML.slice(0, 2500),
    );
    console.log("\nNo card matched. MAIN snippet:\n", snippet);
  }

  await browser.close();
})();
