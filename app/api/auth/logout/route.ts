import { endSession } from "@/lib/session";

// POST /api/auth/logout — end the session and go back to the dashboard.
// A relative Location keeps the redirect on whatever host the visitor used
// (the app sits behind a Cloudflare tunnel, so the server's own host differs).
export async function POST() {
  await endSession();
  return new Response(null, { status: 303, headers: { Location: "/" } });
}
