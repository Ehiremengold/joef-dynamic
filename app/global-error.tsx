"use client";

import ErrorScreen from "@/components/ErrorScreen";

/** The whole site failed to start (the layout itself): the same screen, in a page of its own. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fff" }}>
        <ErrorScreen error={error} />
      </body>
    </html>
  );
}
