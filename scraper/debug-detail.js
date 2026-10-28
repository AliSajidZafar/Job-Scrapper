// Dev-only: probe a single job detail page for the applicant-count element.
require("dotenv").config({ path: ".env.local" });
const { chromium } = require("playwright");
const config = require("./config");

(async () => {
  const jobId = process.argv[2] || "4482209015";
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    storageState: config.session.storageStatePath,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  });
  const page = await ctx.newPage();
  await page.goto(`https://www.linkedin.com/jobs/view/${jobId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  console.log("URL:", page.url());
  console.log("TITLE:", await page.title());

  const probes = [
    "figcaption.num-applicants__caption",
    "span.num-applicants__caption",
    ".num-applicants__caption",
    ".jobs-unified-top-card__applicant-count",
    ".job-details-jobs-unified-top-card__primary-description-container",
    "span.tvm__text",
    ".topcard__flavor--metadata",
  ];
  console.log("\n--- applicant-count probes ---");
  for (const sel of probes) {
    const txt = await page.$$eval(sel, (els) => els.map((e) => e.textContent.trim()).join(" | ")).catch(() => "ERR");
    console.log(`${sel}\n   -> ${txt || "(no match)"}`);
  }

  // Any element whose text mentions "applicant"
  const applicantHits = await page.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .filter((e) => e.children.length === 0 && /applicant/i.test(e.textContent))
      .slice(0, 6)
      .map((e) => `${e.tagName.toLowerCase()}.${(e.className || "").toString().split(" ").join(".")}  => ${e.textContent.trim().slice(0, 60)}`),
  );
  console.log("\n--- elements mentioning 'applicant' ---\n" + (applicantHits.join("\n") || "(none)"));

  await browser.close();
})();
