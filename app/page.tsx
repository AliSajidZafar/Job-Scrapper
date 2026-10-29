import { Dashboard } from "@/components/Dashboard";
import { getSession } from "@/lib/session";

// Public dashboard; the header shows the signed-in visitor (or sign-in links).
export default async function Home() {
  const session = await getSession();
  return <Dashboard user={session ? { name: session.name, role: session.role } : null} />;
}
