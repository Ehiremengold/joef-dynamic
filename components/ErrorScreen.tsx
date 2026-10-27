"use client";

import { useEffect } from "react";

const RELOADED_AT = "jdc-reloaded-after-update";
// Long enough that a page which still fails after reloading shows this screen instead of reloading again.
const RELOAD_GAP_MS = 60_000;

/**
 * A chunk the page asked for is gone: the site was updated while this tab
 * was open, and its old code points at files the new version replaced.
 */
const isStaleCode = (error: Error) => /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module/i.test(`${error.name} ${error.message}`);

/**
 * What a visitor sees when the page itself fails, instead of Next's bare
 * "Application error". It says what to do, offers Reload, and shows the
 * error underneath so a screenshot of it tells us what went wrong. A page
 * left open across an update reloads itself (at most once a minute), which
 * fixes that case.
 */
export default function ErrorScreen({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
    if (!isStaleCode(error)) return;
    try {
      // Once a minute at most: if the reload doesn't help, show this screen rather than reloading forever.
      if (Date.now() - Number(sessionStorage.getItem(RELOADED_AT) ?? 0) < RELOAD_GAP_MS) return;
      sessionStorage.setItem(RELOADED_AT, String(Date.now()));
    } catch {
      return;
    }
    window.location.reload();
  }, [error]);

  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1f2a5c", margin: 0 }}>Something went wrong on this page</h1>
        <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.5, color: "#444" }}>
          Please reload. If you were taking a test, your answers are saved: sign in again and you will carry on where you
          stopped. If this keeps happening, update your phone&rsquo;s software or try another browser, and send the school a
          screenshot of this page.
        </p>
        <button
          type="button"
          // A full reload, not another try with the same code: a stale page needs the new version.
          onClick={() => window.location.reload()}
          style={{ marginTop: 20, padding: "12px 28px", borderRadius: 999, border: 0, background: "#d6252b", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
        >
          Reload
        </button>
        <p style={{ marginTop: 24, fontSize: 12, color: "#888", wordBreak: "break-word" }}>
          {error.name}: {error.message}
          {error.digest ? ` (${error.digest})` : ""}
          <br />
          {typeof navigator !== "undefined" ? navigator.userAgent : ""}
        </p>
      </div>
    </div>
  );
}
