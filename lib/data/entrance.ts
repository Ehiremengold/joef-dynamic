import "server-only";
import { serviceClient } from "@/lib/supabase/server";

export type EntranceAccess = { code: string | null; active: boolean };

export async function getEntranceAccess(): Promise<EntranceAccess> {
  const { data } = await serviceClient()
    .from("entrance_access")
    .select("code, active")
    .eq("id", 1)
    .maybeSingle();
  return { code: (data?.code as string | null) ?? null, active: !!data?.active };
}

export async function setEntranceAccess(patch: {
  code?: string | null;
  active?: boolean;
}): Promise<EntranceAccess> {
  const row: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
  if (patch.code !== undefined) row.code = patch.code;
  if (patch.active !== undefined) row.active = patch.active;
  const { error } = await serviceClient()
    .from("entrance_access")
    .upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return getEntranceAccess();
}

/** True only when a code is set, active, and matches the input exactly. */
export async function verifyEntranceCode(input: string): Promise<boolean> {
  const { code, active } = await getEntranceAccess();
  return active && !!code && input.trim() === code;
}
