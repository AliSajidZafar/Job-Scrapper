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
    { name: "ServiceNow", query: "ServiceNow", match: [/service\s?now/i] },
    { name: "Workday", query: "Workday", match: [/\bworkday\b/i] },
    {
      name: "Data Engineering",
      query: '"Data Engineer"',
      match: [/data engineer/i, /\bETL\b/i, /\b(spark|databricks|snowflake|airflow)\b/i],
    },
    { name: "DevOps", query: "DevOps", match: [/\bdevops\b/i, /\bSRE\b/i, /site reliability/i] },
    {
      name: "AI / ML",
      query: '"Machine Learning"',
      match: [/machine learning/i, /\bML\s?Ops\b/i, /\b(ML|AI) engineer/i, /deep learning/i],
    },
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
    maxJobsPerStack: 25, // hard cap per stack per run (raise toward ~200 for production)
    fetchApplicantCounts: true, // visit each job's detail page for applicant count (slower)
    pageDelayMs: [2000, 5000], // random delay between page loads [min, max]
    stackDelayMs: [5000, 10000], // random delay between stacks [min, max]
  },

  // Where the LinkedIn session lives. Playwright storageState JSON is preferred
  // over a bare cookie string: it survives token rotation better.
  // useLogin is off by default: from a home connection LinkedIn serves the guest
  // layout (which is what scrape.js parses) without any login, so no account is
  // at risk. A login used from a server IP gets signed out by LinkedIn within
  // minutes (seen 2026-10-30 on the VPS), so the scrape runs on the PC.
  session: {
    useLogin: process.env.LINKEDIN_USE_LOGIN === "true",
    storageStatePath: process.env.LINKEDIN_STORAGE_STATE || "scraper/.linkedin-session.json",
  },

  // Optional failure webhook (Discord/Slack-compatible). Leave empty to disable.
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || "",

  // Optional run-report webhook (n8n). Receives every run's outcome as JSON so
  // n8n can email on failures. Leave empty to disable.
  reportWebhookUrl: process.env.SCRAPE_REPORT_URL || "",
};
