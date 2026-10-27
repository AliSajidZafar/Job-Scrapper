// Central scraper configuration.
// Everything that changes between runs (stacks, filters, limits, pacing) lives
// here so tweaking the scrape never means touching the Playwright logic.

module.exports = {
  // Stacks to scrape, in order. `query` is the LinkedIn keyword search string;
  // keep it a phrase for stacks that otherwise match noise (e.g. ".NET", "MERN").
  // `match` is used after fetching to confirm a job really belongs to the stack
  // (title/description), which matters for ".NET" vs "Java"/"JavaScript".
  stacks: [
    { name: "SAP", query: "SAP", match: [/\bSAP\b/i] },
    { name: "Salesforce", query: "Salesforce", match: [/salesforce/i] },
    { name: "MERN", query: '"MERN"', match: [/\bMERN\b/i, /mongo.*express.*react.*node/i] },
    { name: ".NET", query: '".NET"', match: [/\.NET\b/i, /\bC#\b/i, /\bASP\.NET\b/i] },
    { name: "Java", query: '"Java" NOT "JavaScript"', match: [/\bjava\b/i] },
  ],

  // Filters applied to every search (LinkedIn URL query params).
  filters: {
    datePosted: "past-24h", // past 24 hours
    location: "United States",
    remote: true, // include Remote workplace type
    jobTypes: ["contract", "full_time"],
    easyApplyOnly: true, // set false to measure true demand (see README notes)
  },

  // Safety / pacing. Keep these conservative — a dedicated secondary account only.
  limits: {
    maxJobsPerStack: 200, // hard cap per stack per run
    pageDelayMs: [2000, 5000], // random delay between page loads [min, max]
    stackDelayMs: [5000, 10000], // random delay between stacks [min, max]
  },

  // Where the LinkedIn session lives. Playwright storageState JSON is preferred
  // over a bare cookie string: it survives token rotation better.
  session: {
    storageStatePath: process.env.LINKEDIN_STORAGE_STATE || "scraper/.linkedin-session.json",
  },

  // Optional failure webhook (Discord/Slack-compatible). Leave empty to disable.
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || "",
};
