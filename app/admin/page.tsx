import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSession, nameOf, roleOf } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";
import type { ScrapeRun } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Admin · Mavericks Market Intelligence",
  robots: { index: false, follow: false },
};

// Times are shown in Pakistan time, where the team works.
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");

  // Re-check the role in Supabase on every visit, so taking the admin role away
  // takes effect immediately rather than when the 7-day cookie expires.
  const supabase = getSupabaseServer();
  const me = supabase ? (await supabase.auth.admin.getUserById(session.sub)).data.user : null;
  if (!me || roleOf(me) !== "admin") return <NotAdmin />;

  const count = async (table: string) => {
    if (!supabase) return null;
    const { count: n } = await supabase.from(table).select("*", { count: "exact", head: true });
    return n ?? null;
  };

  const [runsRes, jobs, jobSnapshots, searchSnapshots, usersRes] = await Promise.all([
    supabase!.from("scrape_runs").select("*").order("ran_at", { ascending: false }).limit(20),
    count("jobs"),
    count("job_snapshots"),
    count("search_snapshots"),
    supabase!.auth.admin.listUsers({ perPage: 200 }),
  ]);
  const runs = (runsRes.data ?? []) as ScrapeRun[];
  const last = runs[0];
  const users = [...(usersRes.data?.users ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([^.]+)\./)?.[1];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8" />
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight text-ink">
                Mavericks <span className="text-brand">Admin</span>
              </div>
              <div className="hidden text-xs text-muted sm:block">
                Signed in as {session.name} · {session.email}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden rounded-lg border border-line px-3 py-1.5 text-xs text-sub hover:border-brand hover:text-ink sm:inline-block"
            >
              View dashboard
            </Link>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-sub hover:border-crit hover:text-crit"
              >
                Sign out
              </button>
            </form>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">System status</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Jobs stored" value={jobs} />
            <Stat label="Applicant snapshots" value={jobSnapshots} />
            <Stat label="Demand snapshots" value={searchSnapshots} />
            <div className="rounded-xl border border-line bg-card p-4">
              <div className="text-xs text-muted">Last scrape</div>
              {last ? (
                <>
                  <div className="mt-2 text-sm font-semibold text-ink">{fmt(last.ran_at)}</div>
                  <div className="mt-1.5">
                    <RunStatus status={last.status} />
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm text-muted">No runs yet</div>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Scrape run history</h2>
          {runs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-card p-8 text-center text-sm text-muted">
              No scrape runs recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-card">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Ran at (PKT)</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Jobs found</th>
                    <th className="px-3 py-2.5 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-t border-line text-sub first:border-t-0">
                      <td className="px-3 py-2.5 tabular-nums text-ink">{fmt(r.ran_at)}</td>
                      <td className="px-3 py-2.5">
                        <RunStatus status={r.status} />
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{r.jobs_found}</td>
                      <td className="px-3 py-2.5 text-xs">{r.error_message ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Registered users <span className="font-normal normal-case text-sub">({users.length})</span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Email</th>
                  <th className="px-3 py-2.5 font-medium">Role</th>
                  <th className="px-3 py-2.5 font-medium">Joined (PKT)</th>
                  <th className="px-3 py-2.5 font-medium">Last sign-in (PKT)</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: User) => (
                  <tr key={u.id} className="border-t border-line text-sub first:border-t-0">
                    <td className="px-3 py-2.5 font-medium text-ink">{nameOf(u)}</td>
                    <td className="px-3 py-2.5">{u.email}</td>
                    <td className="px-3 py-2.5">
                      {roleOf(u) === "admin" ? (
                        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">admin</span>
                      ) : (
                        <span className="text-xs">user</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{fmt(u.created_at)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{u.last_sign_in_at ? fmt(u.last_sign_in_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Tools</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Tool href="/api/export" title="Download all jobs" text="Every scraped job as a CSV file." />
            {projectRef && (
              <Tool
                href={`https://supabase.com/dashboard/project/${projectRef}`}
                title="Open Supabase"
                text="Database tables, admin users and passwords."
                external
              />
            )}
            <Tool href="/" title="Public dashboard" text="What everyone else sees." />
          </div>
        </section>
      </main>
    </div>
  );
}

function NotAdmin() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="max-w-sm text-center">
        <Logo className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-lg font-semibold text-ink">Admins only</h1>
        <p className="mt-1 text-sm text-muted">Your account doesn&apos;t have access to this page.</p>
        <Link href="/" className="mt-5 inline-block text-sm font-medium text-brand hover:underline">
          ← Back to the dashboard
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-ink">
        {value != null ? value.toLocaleString() : "—"}
      </div>
    </div>
  );
}

function RunStatus({ status }: { status: ScrapeRun["status"] }) {
  const dot = status === "success" ? "bg-good" : status === "partial" ? "bg-warn" : "bg-crit";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-sub">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

function Tool({ href, title, text, external }: { href: string; title: string; text: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="block rounded-xl border border-line bg-card p-4 transition-colors hover:border-brand"
    >
      <div className="text-sm font-medium text-ink">
        {title} {external && <span className="text-muted">↗</span>}
      </div>
      <div className="mt-1 text-xs text-muted">{text}</div>
    </a>
  );
}
