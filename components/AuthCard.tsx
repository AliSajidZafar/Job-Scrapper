import Link from "next/link";
import { Logo } from "./Logo";

// Centered card shared by the sign-in and create-account pages.
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex flex-col items-center text-center">
          <Logo className="h-12 w-12" />
          <span className="mt-3 text-[15px] font-semibold tracking-tight text-ink">
            Mavericks <span className="text-brand">Market Intelligence</span>
          </span>
        </Link>
        <div className="rounded-xl border border-line bg-card p-6">
          <h1 className="text-lg font-semibold text-ink">{title}</h1>
          <p className="mb-5 mt-1 text-xs text-muted">{subtitle}</p>
          {children}
        </div>
        <div className="mt-4 text-center text-xs text-muted">{footer}</div>
      </div>
    </div>
  );
}
