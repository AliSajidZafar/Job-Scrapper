import { redirect } from "next/navigation";

// Old admin sign-in address — everyone now signs in at /login.
export default function AdminLoginRedirect() {
  redirect("/login?next=/admin");
}
