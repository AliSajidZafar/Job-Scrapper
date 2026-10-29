import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import type { Role } from "./types";

// Sign-in session: a small signed cookie issued after Supabase Auth confirms the
// email/password (or creates the account). httpOnly (no JS access) and
// HMAC-signed with SESSION_SECRET, so it can't be read by scripts or forged.
// Server-only — never import from a client component.

export const SESSION_COOKIE = "mvi_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface Session {
  sub: string; // Supabase user id
  email: string;
  name: string;
  role: Role;
  exp: number; // unix seconds
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET is missing or shorter than 32 characters.");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function roleOf(user: Pick<User, "app_metadata">): Role {
  return user.app_metadata?.role === "admin" ? "admin" : "user";
}

export function nameOf(user: Pick<User, "user_metadata" | "email">): string {
  const n = user.user_metadata?.name;
  return typeof n === "string" && n.trim() ? n.trim() : (user.email ?? "User").split("@")[0];
}

export function createSessionToken(user: User): string {
  const session: Session = {
    sub: user.id,
    email: user.email ?? "",
    name: nameOf(user),
    role: roleOf(user),
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    return session.exp > Date.now() / 1000 ? session : null;
  } catch {
    return null;
  }
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};

// Route Handlers / Server Functions only (cookies can't be set while rendering).
export async function startSession(user: User): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(user), cookieOptions);
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

// Read the current visitor's session (Server Components, Route Handlers).
export async function getSession(): Promise<Session | null> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

// Only allow same-site relative redirect targets ("/admin"), never "//evil.com".
export function safeNext(next: unknown, fallback = "/"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
