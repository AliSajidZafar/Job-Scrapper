// Fetch every row of a Supabase query, page by page.
//
// Supabase/PostgREST caps a single response at a fixed number of rows (1000 by
// default), and silently ignores a larger `.limit(...)`. Any query that can
// return more than that — and whose result feeds a total or a count — must page
// through with `.range()` instead, or the numbers come out short. Pass a factory
// that builds the query for a given row window; this loops until a short page
// signals the end.
const PAGE = 1000;

export async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makeQuery(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}
