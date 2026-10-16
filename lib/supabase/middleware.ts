import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Keep a signed-in staff member's Supabase Auth cookies fresh. Sets
 * refreshed cookies on the provided response.
 *
 * This only refreshes; it never decides who may see what (every API route
 * checks that itself). So it reads the session from the cookie with
 * getSession(), which goes to Supabase only when the token is about to
 * expire, instead of getUser(), which is a network round trip on every
 * request. Visitors with no staff cookie (the public site, students) skip
 * it entirely.
 */
export async function refreshStaffSession(
  req: NextRequest,
  res: NextResponse
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return;
  if (!req.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))) return;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refreshes an expiring token into res cookies; otherwise reads the cookie only.
  await supabase.auth.getSession();
}
