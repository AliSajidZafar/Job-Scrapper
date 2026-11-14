// "Prime" = a hot opportunity worth moving on now: a FRESH role (from the latest
// scrape) with FEW applicants that sits in a HIGH-DEMAND stack — the rare overlap
// of low competition and a strong market. When we also have a velocity reading
// (applicants arriving fast) that's an extra signal, but fresh jobs rarely have
// one yet, so it only boosts ranking — it's never required.
//
// Thresholds grounded in the live data:
//  - <= 25 applicants is LinkedIn's "be among the first 25 applicants" band — the
//    genuinely low-competition, early-window roles (finer counts aren't exposed).
//  - stack open-roles median across the 20 stacks is ~5,000; "high demand" means
//    at or above that, i.e. the top half of stacks by current market size.
export const PRIME_MAX_APPLICANTS = 25;
export const PRIME_MIN_STACK_DEMAND = 5000;

// The per-job list is curated server-side (see app/api/prime). Everywhere a job
// is shown, it's marked Prime by membership in that set, so the inline badge and
// the dashboard panel never disagree.
