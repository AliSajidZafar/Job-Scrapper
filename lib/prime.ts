// "Prime" = a hot opportunity worth moving on now: a FRESH role (from the latest
// scrape) with FEW applicants that sits in a HIGH-DEMAND stack — the rare overlap
// of low competition and a strong market. When we also have a velocity reading
// (applicants arriving fast) that's an extra signal, but fresh jobs rarely have
// one yet, so it only boosts ranking — it's never required.
//
// Thresholds grounded in the live data:
//  - <= 25 applicants is LinkedIn's "be among the first 25 applicants" band — the
//    genuinely low-competition, early-window roles (finer counts aren't exposed).
//  - "high demand" means a stack at or above the MEDIAN open-roles total across
//    the 20 stacks — i.e. the top half of stacks by current market size. That
//    median is computed live per request in app/api/prime (not a fixed number),
//    so the bar rises and falls with the market and the panel never blanks out
//    on a day when LinkedIn's reported totals all dip.
export const PRIME_MAX_APPLICANTS = 25;

// The per-job list is curated server-side (see app/api/prime). Everywhere a job
// is shown, it's marked Prime by membership in that set, so the inline badge and
// the dashboard panel never disagree.
