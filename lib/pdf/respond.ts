import "server-only";

/** Turn a PDF buffer into a downloadable Response, staff routes share this. */
export function pdfResponse(buffer: Buffer, filename: string): Response {
  const safe = filename.replace(/[^a-z0-9\-_. ]/gi, "").replace(/\s+/g, "-");
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safe}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
