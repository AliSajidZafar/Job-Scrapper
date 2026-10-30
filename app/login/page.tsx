import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, safeNext } from "@/lib/session";
import { AuthCard } from "@/components/AuthCard";
import { LoginForm } from "@/components/AuthForms";

export const metadata: Metadata = {
  title: "Sign in · Mavericks Market Intelligence",
  robots: { index: false, follow: false },
};

export default async function LoginPage(props: PageProps<"/login">) {
  const next = safeNext((await props.searchParams).next);
  if (await getSession()) redirect(next);

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your Mavericks account."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-semibold text-brand hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthCard>
  );
}
