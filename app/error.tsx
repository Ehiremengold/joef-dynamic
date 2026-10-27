"use client";

import ErrorScreen from "@/components/ErrorScreen";

/** A page failed while showing: say so, and offer Reload (see ErrorScreen). */
export default function Error({ error }: { error: Error & { digest?: string } }) {
  return <ErrorScreen error={error} />;
}
