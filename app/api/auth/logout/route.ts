import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearTakerSession } from "@/lib/auth/session";
import { authClient } from "@/lib/supabase/serverAuth";

/** Supabase's staff login cookies: sb-<project>-auth-token, split into .0, .1… when long. */
const isStaffAuthCookie = (name: string) => name.startsWith("sb-") && name.includes("-auth-token");

/**
 * POST /api/auth/logout — signs out whoever is signed in on this browser:
 * the taker (student/candidate) session and the staff Supabase session.
 *
 * Staff sign-out is done here rather than by the browser's Supabase client,
 * whose signOut() waits on an internal lock and can hang while a token
 * refresh holds it. The login is ended with Supabase (best effort, briefly),
 * and its cookies are removed regardless, so signing out always works.
 */
export async function POST() {
  await clearTakerSession();
  const store = await cookies();
  if (store.getAll().some((c) => isStaffAuthCookie(c.name))) {
    const supabase = await authClient();
    await Promise.race([
      supabase.auth.signOut({ scope: "local" }).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    for (const c of store.getAll()) if (isStaffAuthCookie(c.name)) store.delete(c.name);
  }
  return NextResponse.json({ ok: true });
}
