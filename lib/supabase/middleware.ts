import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Refresh the staff Supabase Auth session on each request so cookies stay
 * valid. Sets refreshed cookies on the provided response.
 */
export async function refreshStaffSession(
  req: NextRequest,
  res: NextResponse
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return;

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

  // Touch the session so expiring tokens get refreshed into res cookies.
  await supabase.auth.getUser();
}
