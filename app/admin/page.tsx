import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSession, nameOf, roleOf } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";
import { getSummary } from "@/lib/summary";
import { STACK_COLOR_VAR, type ScrapeRun, type SummaryData } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Admin · Mavericks Market Intelligence",
  robots: { index: false, follow: false },
};

const N8N_URL = "https://n8n.mavericksunited.co";
const SCRAPE_HOUR_PKT = 19; // Windows task on the PC runs the scrape at 7 PM PKT
const PKT_OFFSET_H = 5; // Pakistan has no DST

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
const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", day: "numeric", month: "short" });

function nextScrape(now: Date) {
  const next = new Date(now);
  next.setUTCHours(SCRAPE_HOUR_PKT - PKT_OFFSET_H, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function relative(ms: number) {
  const m = Math.round(Math.abs(ms) / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} days`;
}

type Health = { tone: "good" | "warn" | "crit"; title: string; detail: string };

function health(last: ScrapeRun | undefined, now: Date): Health {
  if (!last) return { tone: "warn", title: "No scrape runs yet", detail: "The first run will appear here." };
  const age = now.getTime() - new Date(last.ran_at).getTime();
  if (last.status === "failed")
    return { tone: "crit", title: "The last scrape failed", detail: last.error_message ?? "Check the run history below." };
  if (age > 26 * 3600_000)
    return { tone: "warn", title: `No scrape in ${relative(age)}`, detail: "Is the PC on at 7 PM? n8n emails a reminder at 9 PM." };
  if (last.status === "partial")
    return { tone: "warn", title: "Last scrape partly succeeded", detail: last.error_message ?? "Some stacks failed." };
  return { tone: "good", title: "Everything is running", detail: `Last scrape ${relative(age)} ago saved ${last.jobs_found} jobs.` };
}

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");

  // Re-check the role in Supabase on every visit, so taking the admin role away
  // takes effect immediately rather than when the 7-day cookie expires.
  const supabase = getSupabaseServer();
  const me = supabase ? (await supabase.auth.admin.getUserById(session.sub)).data.user : null;
  if (!me || roleOf(me) !== "admin") return <NotAdmin />;

  const count = async (table: string) => {
    const { count: n } = await supabase!.from(table).select("*", { count: "exact", head: true });
    return n ?? null;
  };

  const [runsRes, jobs, jobSnapshots, searchSnapshots, usersRes, summary] = await Promise.all([
    supabase!.from("scrape_runs").select("*").order("ran_at", { ascending: false }).limit(30),
    count("jobs"),
    count("job_snapshots"),
    count("search_snapshots"),
    supabase!.auth.admin.listUsers({ perPage: 200 }),
    getSummary(supabase!),
  ]);
  const runs = (runsRes.data ?? []) as ScrapeRun[];
  const last = runs[0];
  const users = [...(usersRes.data?.users ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const now = new Date();
  const next = nextScrape(now);
  const h = health(last, now);
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([^.]+)\./)?.[1];
  const hourPkt = (now.getUTCHours() + PKT_OFFSET_H) % 24;
  const greeting = hourPkt < 12 ? "Good morning" : hourPkt < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-3">
            <Logo className="h-8 w-8" />
            <div className="text-[15px] font-semibold leading-tight tracking-tight text-ink">
              Mavericks <span className="text-brand">Admin</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-sub transition-colors hover:border-brand hover:text-ink sm:inline-block"
            >
              View dashboard
            </Link>
            <span className="hidden items-center gap-2 rounded-lg border border-line py-1 pl-1 pr-2.5 md:flex" title={session.email}>
              <Avatar name={session.name} className="h-6 w-6 text-[10px]" />
              <span className="text-xs font-medium text-ink">{session.name}</span>
            </span>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-sub transition-colors hover:border-crit hover:text-crit"
              >
                Sign out
              </button>
            </form>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {/* Greeting + health */}
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {greeting}, {session.name.split(" ")[0]}
            </h1>
            <p className="mt-1 text-sm text-sub">Here&apos;s how the scraper, the data and your users are doing.</p>
          </div>
          <div className="rounded-xl border border-line bg-card px-4 py-2.5 text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted">Next scrape</div>
            <div className="text-sm font-semibold tabular-nums text-ink">
              {fmt(next.toISOString())} <span className="font-normal text-sub">· in {relative(next.getTime() - now.getTime())}</span>
            </div>
          </div>
        </section>

        <HealthBanner health={h} />

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Jobs stored" value={jobs} hint="Unique LinkedIn postings" icon="briefcase" />
          <Kpi label="Applicant readings" value={jobSnapshots} hint="Feeds applicants-per-hour" icon="users" />
          <Kpi label="Demand readings" value={searchSnapshots} hint="Open-role totals per stack/day" icon="trend" />
          <Kpi label="Registered users" value={users.length} hint={`${users.filter((u) => isNew(u, now)).length} joined this week`} icon="user" />
        </section>

        {/* Activity + automation */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card title="Scrape activity" subtitle="Jobs saved per run" className="lg:col-span-2">
            <RunChart runs={runs} />
          </Card>
          <Card title="Automation" subtitle="How the daily scrape runs">
            <dl className="space-y-3 text-sm">
              <Row label="Schedule">Daily at 7:00 PM PKT</Row>
              <Row label="Runs on">Office PC (Windows task)</Row>
              <Row label="Alerts">Email via n8n on failure or a missed run</Row>
              <Row label="Last run">{last ? <RunStatus status={last.status} /> : "—"}</Row>
            </dl>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <a
                href={N8N_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-brand px-3 py-2 text-center text-xs font-semibold text-brand-ink transition-opacity hover:opacity-90"
              >
                Open n8n ↗
              </a>
              <a
                href="/api/export"
                className="rounded-lg border border-line px-3 py-2 text-center text-xs font-semibold text-ink transition-colors hover:border-brand"
              >
                Download CSV
              </a>
            </div>
          </Card>
        </section>

        {/* Market by stack */}
        <Card title="Market by stack" subtitle="Latest open roles on LinkedIn and applicant competition">
          <StackTable summary={summary} />
        </Card>

        {/* Run history */}
        <Card title="Run history" subtitle={`Last ${runs.length} scrape runs`} flush>
          {runs.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">No scrape runs recorded yet.</p>
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-card text-xs uppercase tracking-wide text-muted">
                  <tr className="border-b border-line">
                    <th className="px-5 py-2.5 font-medium">Ran at (PKT)</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 text-right font-medium">Jobs</th>
                    <th className="px-5 py-2.5 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-t border-line text-sub first:border-t-0 hover:bg-plane/60">
                      <td className="px-5 py-2.5 tabular-nums text-ink">{fmt(r.ran_at)}</td>
                      <td className="px-3 py-2.5">
                        <RunStatus status={r.status} />
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.jobs_found}</td>
                      <td className="px-5 py-2.5 text-xs">{r.error_message ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Users */}
        <Card title="Registered users" subtitle={`${users.length} account${users.length === 1 ? "" : "s"}`} flush>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-2.5 font-medium">User</th>
                  <th className="px-3 py-2.5 font-medium">Role</th>
                  <th className="px-3 py-2.5 font-medium">Joined (PKT)</th>
                  <th className="px-5 py-2.5 font-medium">Last sign-in (PKT)</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: User) => (
                  <tr key={u.id} className="border-t border-line text-sub first:border-t-0 hover:bg-plane/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={nameOf(u)} className="h-8 w-8 text-xs" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 font-medium text-ink">
                            {nameOf(u)}
                            {isNew(u, now) && (
                              <span className="rounded-full bg-good/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-good">
                                New
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-muted">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {roleOf(u) === "admin" ? (
                        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">Admin</span>
                      ) : (
                        <span className="rounded-full border border-line px-2 py-0.5 text-xs">User</span>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{fmt(u.created_at)}</td>
                    <td className="px-5 py-3 tabular-nums">{u.last_sign_in_at ? fmt(u.last_sign_in_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Tools */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink">Tools</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tool href="/api/export" title="Download all jobs" text="Every scraped job as a CSV file." icon="download" />
            <Tool href={N8N_URL} title="n8n automation" text="Alert workflows and their run log." icon="bolt" external />
            {projectRef && (
              <Tool
                href={`https://supabase.com/dashboard/project/${projectRef}`}
                title="Supabase"
                text="Database tables, users and passwords."
                icon="database"
                external
              />
            )}
            <Tool href="/" title="Public dashboard" text="What everyone else sees." icon="chart" />
          </div>
        </section>
      </main>
    </div>
  );
}

const isNew = (u: User, now: Date) => now.getTime() - new Date(u.created_at).getTime() < 7 * 86400_000;

function NotAdmin() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="max-w-sm rounded-2xl border border-line bg-card p-8 text-center">
        <Logo className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-lg font-semibold text-ink">Admins only</h1>
        <p className="mt-1 text-sm text-muted">Your account doesn&apos;t have access to this page.</p>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90">
          Back to the dashboard
        </Link>
      </div>
    </div>
  );
}

function HealthBanner({ health: h }: { health: Health }) {
  const tone = {
    good: { box: "border-good/30 bg-good/10", dot: "bg-good", text: "text-good" },
    warn: { box: "border-warn/40 bg-warn/10", dot: "bg-warn", text: "text-warn" },
    crit: { box: "border-crit/40 bg-crit/10", dot: "bg-crit", text: "text-crit" },
  }[h.tone];
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${tone.box}`}>
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {h.tone === "good" && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${tone.dot}`} />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${tone.dot}`} />
      </span>
      <div className="text-sm">
        <span className={`font-semibold ${tone.text}`}>{h.title}</span>
        <span className="text-sub"> · {h.detail}</span>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
  className = "",
  flush,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-line bg-card ${className}`}>
      <div className={`px-5 pt-4 ${flush ? "pb-3" : ""}`}>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      <div className={flush ? "border-t border-line" : "p-5 pt-4"}>{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

// Jobs saved per run, oldest → newest (last 14 runs).
function RunChart({ runs }: { runs: ScrapeRun[] }) {
  const series = runs.slice(0, 14).reverse();
  if (series.length === 0) return <p className="py-10 text-center text-sm text-muted">No runs yet.</p>;
  const peak = Math.max(1, ...series.map((r) => r.jobs_found));
  const bar = { success: "bg-brand", partial: "bg-warn", failed: "bg-crit" } as const;

  return (
    <div>
      <div className="flex h-40 items-end gap-2 border-b border-line">
        {series.map((r) => (
          <div key={r.id} className="group relative flex h-full flex-1 flex-col justify-end">
            <span className="mb-1 text-center text-[10px] tabular-nums text-muted opacity-0 transition-opacity group-hover:opacity-100">
              {r.jobs_found}
            </span>
            <div
              className={`mx-auto w-full max-w-10 rounded-t-md ${bar[r.status]} transition-opacity group-hover:opacity-80`}
              style={{ height: `${Math.max(2, (r.jobs_found / peak) * 85)}%` }}
              title={`${fmt(r.ran_at)} · ${r.status} · ${r.jobs_found} jobs`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {series.map((r) => (
          <span key={r.id} className="flex-1 truncate text-center text-[10px] text-muted">
            {fmtDay(r.ran_at)}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-sub">
        <Legend className="bg-brand" label="Success" />
        <Legend className="bg-warn" label="Partial" />
        <Legend className="bg-crit" label="Failed" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function StackTable({ summary }: { summary: SummaryData }) {
  const peak = Math.max(1, ...summary.stacks.map((s) => s.open_roles ?? 0));
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr className="border-b border-line">
            <th className="px-5 py-2 font-medium">Stack</th>
            <th className="px-3 py-2 font-medium">Open roles</th>
            <th className="px-3 py-2 text-right font-medium">Tracked</th>
            <th className="px-3 py-2 text-right font-medium">Avg applicants</th>
            <th className="px-5 py-2 text-right font-medium">Most applicants</th>
          </tr>
        </thead>
        <tbody>
          {summary.stacks.map((s) => (
            <tr key={s.stack} className="border-t border-line text-sub first:border-t-0">
              <td className="px-5 py-2.5">
                <span className="flex items-center gap-2 font-medium text-ink">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(${STACK_COLOR_VAR[s.stack]})` }} />
                  {s.stack}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-3">
                  <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-line sm:block">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${((s.open_roles ?? 0) / peak) * 100}%`, background: `var(${STACK_COLOR_VAR[s.stack]})` }}
                    />
                  </span>
                  <span className="tabular-nums text-ink">{s.open_roles != null ? s.open_roles.toLocaleString() : "—"}</span>
                </span>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{s.captured}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{s.avg_applicants ?? "—"}</td>
              <td className="px-5 py-2.5 text-right tabular-nums">{s.max_applicants ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Avatar({ name, className = "" }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand ${className}`}>
      {initials || "?"}
    </span>
  );
}

const KPI_ICONS = {
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  users: <path d="M16 20a6 6 0 0 0-12 0M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 20a5 5 0 0 0-4-4.9M15 3.2a4 4 0 0 1 0 7.6" />,
  trend: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  user: <path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />,
  download: <path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />,
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
};

function GlyphIcon({ name, className = "" }: { name: keyof typeof KPI_ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {KPI_ICONS[name]}
    </svg>
  );
}

function Kpi({ label, value, hint, icon }: { label: string; value: number | null; hint: string; icon: keyof typeof KPI_ICONS }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-sub">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
          <GlyphIcon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink">
        {value != null ? value.toLocaleString() : "—"}
      </div>
      <div className="mt-0.5 text-xs text-muted">{hint}</div>
    </div>
  );
}

function RunStatus({ status }: { status: ScrapeRun["status"] }) {
  const tone =
    status === "success"
      ? "bg-good/10 text-good"
      : status === "partial"
        ? "bg-warn/10 text-warn"
        : "bg-crit/10 text-crit";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function Tool({
  href,
  title,
  text,
  icon,
  external,
}: {
  href: string;
  title: string;
  text: string;
  icon: keyof typeof KPI_ICONS;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="group flex gap-3 rounded-xl border border-line bg-card p-4 transition-colors hover:border-brand"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-plane text-sub transition-colors group-hover:bg-brand-soft group-hover:text-brand">
        <GlyphIcon name={icon} className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-sm font-medium text-ink">
          {title} {external && <span className="text-muted">↗</span>}
        </span>
        <span className="mt-0.5 block text-xs text-muted">{text}</span>
      </span>
    </a>
  );
}
