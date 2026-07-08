import { NextResponse, type NextRequest } from "next/server";
import { refreshStaffSession } from "@/lib/supabase/middleware";

/**
 * Two jobs:
 *  1. Keep the staff auth session fresh (Supabase cookie refresh).
 *  2. Serve the portal from the `portal.` subdomain, and keep the private
 *     portal OFF the public apex domain in production.
 *
 * Locally (localhost) everything is served from one origin under /portal.
 */
export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const portalHost = process.env.NEXT_PUBLIC_PORTAL_HOST || "";
  const onPortal =
    host.startsWith("portal.") || (portalHost && host === portalHost);

  const url = req.nextUrl;

  let res: NextResponse;

  if (onPortal && url.pathname === "/") {
    // portal.example.com/  →  render the portal home
    const rewritten = url.clone();
    rewritten.pathname = "/portal";
    res = NextResponse.rewrite(rewritten);
  } else if (!isLocal && !onPortal && url.pathname.startsWith("/portal")) {
    // Public apex must not serve the private portal — bounce to the subdomain.
    if (portalHost) {
      return NextResponse.redirect(
        `https://${portalHost}${url.pathname}${url.search}`
      );
    }
    res = NextResponse.next();
  } else {
    res = NextResponse.next();
  }

  await refreshStaffSession(req, res);
  return res;
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|fonts/).*)"],
};
