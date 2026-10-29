import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { startSession } from "@/lib/session";
import { clientIp, hit, isLimited } from "@/lib/rate-limit";

// POST /api/auth/signup — create a regular ("user") account and sign it in.
// Accounts are created server-side with the service-role key and marked as
// confirmed, because the Supabase project can't email the public yet (no
// custom SMTP). New accounts never get the admin role — only
// scripts/create-admin.js sets that. Max 5 new accounts per IP per hour.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_SIGNUPS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const key = `signup:${clientIp(req)}`;
  if (isLimited(key, MAX_SIGNUPS)) {
    return Response.json({ error: "Too many new accounts from your network. Try again in an hour." }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { name?: string; email?: string; password?: string } | null;
  const name = body?.name?.trim() ?? "";
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";

  if (name.length < 2 || name.length > 60) {
    return Response.json({ error: "Enter your name (2–60 characters)." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 72) {
    return Response.json({ error: "Password must be 8–72 characters." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return Response.json({ error: "Sign-up isn't configured on this server." }, { status: 503 });
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error || !data.user) {
    if (error?.code === "email_exists" || /already (been )?registered/i.test(error?.message ?? "")) {
      return Response.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
    }
    if (error?.code === "weak_password") {
      return Response.json({ error: "That password is too weak. Try a longer one." }, { status: 400 });
    }
    return Response.json({ error: "Couldn't create the account. Please try again." }, { status: 500 });
  }

  hit(key, WINDOW_MS);
  await startSession(data.user);
  return Response.json({ ok: true });
}
