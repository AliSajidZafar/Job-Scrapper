// Create the dashboard admin user in Supabase Auth — or, if it already exists,
// give it a fresh password. The password is generated here and written to a
// file in your home folder; it is never printed to the terminal.
//
// Usage (from the project folder):  node scripts/create-admin.js

require("dotenv").config({ path: ".env.local", quiet: true });

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const EMAIL = "admin@mavericksunited.co";
const NAME = "Mavericks";
const SIGN_IN_URL = "https://jobs.mavericksunited.co/login";
const OUT_FILE = path.join(os.homedir(), "Mavericks-admin-login.txt");

// 20 characters from an unambiguous set (no 0/O, 1/l/I).
function makePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%*-_";
  return Array.from(crypto.randomBytes(20), (b) => chars[b % chars.length]).join("");
}

async function findUser(supabase, email) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit || data.users.length < 200) return hit ?? null;
  }
}

(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env.local");

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const password = makePassword();
  const attrs = {
    password,
    email_confirm: true,
    user_metadata: { name: NAME },
    app_metadata: { role: "admin" },
  };

  const existing = await findUser(supabase, EMAIL);
  const { data, error } = existing
    ? await supabase.auth.admin.updateUserById(existing.id, attrs)
    : await supabase.auth.admin.createUser({ email: EMAIL, ...attrs });
  if (error) throw error;

  fs.writeFileSync(
    OUT_FILE,
    [
      "Mavericks Market Intelligence — admin login",
      "",
      `Sign-in page: ${SIGN_IN_URL}`,
      `Name:         ${NAME}`,
      `Email:        ${EMAIL}`,
      `Password:     ${password}`,
      "",
      "Save these in a password manager, then delete this file.",
      "To get a new password, run from the project folder: node scripts/create-admin.js",
      "",
    ].join("\r\n"),
    { mode: 0o600 },
  );

  console.log(`${existing ? "Reset password for" : "Created"} admin "${NAME}" <${EMAIL}> (id ${data.user.id}).`);
  console.log(`Login details saved to: ${OUT_FILE}`);
})().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
