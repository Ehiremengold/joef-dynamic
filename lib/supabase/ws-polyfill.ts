import "server-only";
import ws from "ws";

/**
 * Node < 22 has no global WebSocket. @supabase/supabase-js constructs a Realtime
 * client eagerly (which needs one) even though we never use Realtime. Provide the
 * `ws` implementation as the global so createClient() doesn't throw. On Node 22+
 * (e.g. Vercel's default) a native WebSocket already exists and this is a no-op.
 */
const g = globalThis as unknown as { WebSocket?: unknown };
if (typeof g.WebSocket === "undefined") {
  g.WebSocket = ws;
}
