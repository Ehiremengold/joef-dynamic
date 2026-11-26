import "server-only";

/**
 * Turn a PDF buffer into a Response, staff routes share this. By default it
 * downloads; `inline` opens it in the browser's own viewer instead, where it
 * can be printed or saved (and shared, on a phone).
 */
export function pdfResponse(buffer: Buffer, filename: string, { inline = false }: { inline?: boolean } = {}): Response {
  const safe = filename.replace(/[^a-z0-9\-_. ]/gi, "").replace(/\s+/g, "-");
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safe}"`,
      "Content-Length": String(buffer.length),
    },
  });
}

/**
 * For a document link opened in a new tab: a plain page saying why there is
 * nothing to show, instead of raw JSON.
 */
export function documentUnavailable(message: string, status = 404): Response {
  const escaped = message.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>Nothing to print yet</title></head>` +
      `<body style="margin:0;background:#f5f5f7;color:#1d1d1f;font:16px/1.5 system-ui,sans-serif">` +
      `<main style="max-width:520px;margin:15vh auto;padding:24px;background:#fff;border:1px solid #e5e5ea;border-radius:12px">` +
      `<h1 style="font-size:20px;margin:0 0 8px">Nothing to print yet</h1><p style="margin:0">${escaped}</p>` +
      `<p style="margin:16px 0 0;color:#6e6e73;font-size:14px">You can close this tab.</p></main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
