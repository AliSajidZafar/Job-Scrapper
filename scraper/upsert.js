// Supabase persistence for scraped jobs.
// Dedups by linkedin_job_id, records stack tags, and logs each run.

const { createClient } = require("@supabase/supabase-js");

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Upsert one stack's worth of jobs. Returns how many rows were written.
async function upsertJobs(jobs) {
  if (jobs.length === 0) return 0;
  const supabase = getClient();

  // 1. Upsert the job rows (dedup on linkedin_job_id).
  const jobRows = jobs.map((j) => ({
    linkedin_job_id: j.linkedin_job_id,
    title: j.title,
    company: j.company,
    location: j.location,
    job_type: j.job_type ?? null,
    easy_apply: j.easy_apply,
    applicant_count: j.applicant_count,
    posted_at: j.posted_at,
  }));

  const { data: upserted, error } = await supabase
    .from("jobs")
    .upsert(jobRows, { onConflict: "linkedin_job_id" })
    .select("id, linkedin_job_id");
  if (error) throw error;

  // 2. Map linkedin_job_id -> uuid, then insert stack tags (idempotent).
  const idByLinkedin = new Map(upserted.map((r) => [r.linkedin_job_id, r.id]));
  const stackRows = jobs
    .map((j) => ({ job_id: idByLinkedin.get(j.linkedin_job_id), stack: j.stack }))
    .filter((r) => r.job_id);

  if (stackRows.length) {
    const { error: stackErr } = await supabase
      .from("job_stacks")
      .upsert(stackRows, { onConflict: "job_id,stack", ignoreDuplicates: true });
    if (stackErr) throw stackErr;
  }

  // 3. Append an applicant-count snapshot for every job this run (suggestion #3).
  //    Each run adds one row per job, so velocity can be computed over time.
  const snapshotRows = jobs
    .map((j) => ({
      job_id: idByLinkedin.get(j.linkedin_job_id),
      applicant_count: j.applicant_count,
    }))
    .filter((r) => r.job_id);

  if (snapshotRows.length) {
    const { error: snapErr } = await supabase.from("job_snapshots").insert(snapshotRows);
    if (snapErr) throw snapErr;
  }

  return jobRows.length;
}

// Record one stack's reported result total for this run (suggestion #2).
async function recordSearchSnapshot({ stack, totalResults, scrapedCount }) {
  const supabase = getClient();
  const { error } = await supabase.from("search_snapshots").insert({
    stack,
    total_results: totalResults,
    scraped_count: scrapedCount,
  });
  if (error) console.error(`Failed to record search snapshot for ${stack}:`, error.message);
}

// Record the outcome of a full run in scrape_runs.
async function logRun({ jobsFound, status, errorMessage = null }) {
  const supabase = getClient();
  const { error } = await supabase.from("scrape_runs").insert({
    jobs_found: jobsFound,
    status,
    error_message: errorMessage,
  });
  if (error) console.error("Failed to log scrape run:", error.message);
}

module.exports = { upsertJobs, logRun, recordSearchSnapshot };
