/**
 * Create the first administrator account. Run once after the migrations.
 *
 *   node scripts/seed-admin.mjs
 *
 * Reads FIRST_ADMIN_NAME / FIRST_ADMIN_EMAIL / FIRST_ADMIN_PASSWORD and the
 * Supabase env from .env.local (loaded here manually — no framework runtime).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import ws from "ws";

// Node < 22 has no global WebSocket; supabase-js needs one at construct time.
if (typeof globalThis.WebSocket === "undefined") globalThis.WebSocket = ws;

// tiny .env.local loader (avoids adding dotenv)
try {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* rely on real env */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const name = process.env.FIRST_ADMIN_NAME || "Administrator";
const email = process.env.FIRST_ADMIN_EMAIL;
const password = process.env.FIRST_ADMIN_PASSWORD;

if (!url || !key || !email || !password) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIRST_ADMIN_EMAIL, FIRST_ADMIN_PASSWORD."
  );
  process.exit(1);
}

const supa = createClient(url, key, {
  auth: { persistSession: false },
});

const { data: created, error: authErr } = await supa.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: name },
});
if (authErr) {
  console.error("Could not create auth user:", authErr.message);
  process.exit(1);
}

const { error: profErr } = await supa.from("staff").insert({
  id: created.user.id,
  full_name: name,
  email,
  role: "admin",
});
if (profErr) {
  await supa.auth.admin.deleteUser(created.user.id).catch(() => {});
  console.error("Could not create staff profile:", profErr.message);
  process.exit(1);
}

console.log(`✅ Admin ready. Sign in at /portal/staff with ${email}`);
