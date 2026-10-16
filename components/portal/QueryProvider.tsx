"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/client/api";

/** One cache for the whole portal, so tabs and pages share what they've loaded. */
export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
