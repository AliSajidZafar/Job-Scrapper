import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AuthCard } from "@/components/AuthCard";
import { SignupForm } from "@/components/AuthForms";

export const metadata: Metadata = {
  title: "Create account · Mavericks Market Intelligence",
  robots: { index: false, follow: false },
};

export default async function SignupPage() {
  if (await getSession()) redirect("/");

  return (
    <AuthCard
      title="Create your account"
      subtitle="Free to join. Takes less than a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
