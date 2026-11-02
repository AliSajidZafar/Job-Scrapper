import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { getSession } from "@/lib/session";

// Private dashboard: visitors must sign in (or create an account) first. Once
// signed in, both members and admins land here on the main dashboard; admins
// additionally get the Admin link in the account menu.
export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <Dashboard user={{ name: session.name, role: session.role }} />;
}
