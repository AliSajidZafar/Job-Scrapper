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
    { name: "MERN", query: '"MERN"', match: [/\bMERN\b/i, /\bmongo/i, /(?=[\s\S]*\breact)(?=[\s\S]*\bnode)/i], trustSearch: true },
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
    // Niche / specialist stacks (set 2). Queries are quoted phrases to cut noise;
    // match runs against the job TITLE, so each pattern targets dedicated roles.
    { name: "Rust", query: '"Rust"', match: [/\brust\b/i], trustSearch: true },
    { name: "Elixir", query: '"Elixir"', match: [/\belixir\b/i, /\berlang\b/i, /phoenix/i], trustSearch: true },
    { name: "C++", query: '"C++"', match: [/\bc\+\+/i, /\bcpp\b/i] },
    { name: "Haskell", query: '"Haskell"', match: [/\bhaskell\b/i, /\bocaml\b/i, /\bscala\b/i], trustSearch: true },
    { name: "SRE", query: '"Site Reliability Engineer"', match: [/site reliability/i, /\bSRE\b/] },
    { name: "Embedded", query: '"Embedded"', match: [/\bembedded\b/i, /\bfirmware\b/i, /\bRTOS\b/i, /microcontroller/i] },
    { name: "GIS", query: '"GIS"', match: [/\bGIS\b/, /geospatial/i, /\bPostGIS\b/i, /\bArcGIS\b/i] },
    { name: "COBOL", query: '"COBOL"', match: [/\bcobol\b/i, /\bmainframe\b/i, /z\/OS/i, /\bJCL\b/] },
    { name: "CUDA", query: '"CUDA"', match: [/\bcuda\b/i, /GPU kernel/i, /\bTriton\b/, /\bPTX\b/], trustSearch: true },
    {
      name: "Edge AI",
      query: '"Edge AI"',
      match: [/edge ai/i, /on-device/i, /tensorflow lite/i, /\bTFLite\b/i, /\bONNX\b/i, /\bCoreML\b/i],
      trustSearch: true,
    },
  ],

  // Filters applied to every search (LinkedIn URL query params).
  filters: {
    datePosted: "past-24h", // past 24 hours
    location: "United States",
    remote: true, // include Remote workplace type
    jobTypes: ["contract", "full_time"],
    // Capture BOTH Easy Apply and external listings (true demand), and detect
    // each job's real apply route + employment type from its detail page. Set
    // true again to restrict the search to Easy Apply only.
    easyApplyOnly: false,
  },

  // Safety / pacing. Keep these conservative — a dedicated secondary account only.
  limits: {
    // Env override (MAX_JOBS_PER_STACK) lets a one-off catch-up run use a smaller
    // cap when LinkedIn detail pages are slow; the scheduled run uses the default.
    // With 20 stacks a full run visits many detail pages, so the default per-stack
    // cap is 15 to keep the nightly run to a reasonable length. Open-role totals
    // (true demand) are captured regardless of the cap; this only bounds the
    // detailed sample. Override with MAX_JOBS_PER_STACK for a one-off.
    maxJobsPerStack: Number(process.env.MAX_JOBS_PER_STACK) || 15, // hard cap per stack per run
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
