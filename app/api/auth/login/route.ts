import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { roleOf, startSession } from "@/lib/session";
import { clear, clientIp, hit, isLimited } from "@/lib/rate-limit";

// POST /api/auth/login — check email/password against Supabase Auth and start a
// session. 5 wrong attempts from one IP lock sign-in for 15 minutes.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export async function POST(req: NextRequest) {
  const key = `login:${clientIp(req)}`;
  if (isLimited(key, MAX_FAILURES)) {
    return Response.json({ error: "Too many attempts. Please wait 15 minutes and try again." }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;
  if (!email || !password) {
    return Response.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return Response.json({ error: "Sign-in isn't configured on this server." }, { status: 503 });
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    hit(key, WINDOW_MS);
    return Response.json({ error: "Wrong email or password." }, { status: 401 });
  }

  clear(key);
  await startSession(data.user);
  return Response.json({ ok: true, role: roleOf(data.user) });
}
