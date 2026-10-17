import "server-only";
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase/server";
import type { Staff, StaffRole } from "@/lib/types";

type Row = Record<string, unknown>;

function mapStaff(r: Row): Staff {
  return {
    id: r.id as string,
    fullName: r.full_name as string,
    email: r.email as string,
    role: r.role as StaffRole,
    active: r.active as boolean,
    createdAt: r.created_at as string,
  };
}

export async function listStaff(): Promise<Staff[]> {
  const { data } = await serviceClient()
    .from("staff")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapStaff);
}

/**
 * Create a staff member: makes the Supabase Auth user (email confirmed) and the
 * linked staff profile. Returns the profile. Rolls back the auth user on failure.
 */
// No 0/O, 1/l/I: a password read off a screen or a slip of paper has to be typed back.
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A random password like "k7Rm-Qx4p-Z9wa": 12 characters, easy to read out, hard to guess. */
export function generatePassword(): string {
  const chars = Array.from({ length: 12 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map((g) => g.join("")).join("-");
}

/** Give a staff member a new sign-in password; returns it in plain text, to be shown once. */
export async function resetStaffPassword(id: string): Promise<string> {
  const password = generatePassword();
  const { error } = await serviceClient().auth.admin.updateUserById(id, { password });
  if (error) throw new Error(error.message);
  return password;
}

/**
 * A staff member changing their own password. The current one is checked by
 * signing in with it on a throwaway client (nothing is stored), then the
 * new one is set. Throws with a message fit for the screen.
 */
export async function changeOwnPassword(staff: { id: string; email: string }, current: string, next: string): Promise<void> {
  const check = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: wrong } = await check.auth.signInWithPassword({ email: staff.email, password: current });
  if (wrong) throw new Error("Your current password isn't right");
  // That check opened a session of its own; close it rather than leave it lying around.
  await check.auth.signOut({ scope: "local" }).catch(() => undefined);
  const { error } = await serviceClient().auth.admin.updateUserById(staff.id, { password: next });
  if (error) throw new Error(error.message);
}

export async function createStaff(input: {
  fullName: string;
  email: string;
  password: string;
  role: StaffRole;
}): Promise<Staff> {
  const supa = serviceClient();
  const { data: created, error: authErr } = await supa.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (authErr || !created.user) {
    throw new Error(authErr?.message || "Could not create the auth user");
  }

  const { data, error } = await supa
    .from("staff")
    .insert({
      id: created.user.id,
      full_name: input.fullName,
      email: input.email,
      role: input.role,
    })
    .select("*")
    .single();

  if (error) {
    // roll back the orphaned auth user so email stays reusable
    await supa.auth.admin.deleteUser(created.user.id).catch(() => {});
    if ((error as { code?: string }).code === "23505") {
      throw new Error("That email already has a staff account");
    }
    throw new Error(error.message);
  }
  return mapStaff(data);
}

export async function getStaffById(id: string): Promise<Staff | null> {
  const { data } = await serviceClient()
    .from("staff")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapStaff(data) : null;
}

/** How many admins can still sign in — the portal must never drop to zero. */
export async function countActiveAdmins(): Promise<number> {
  const { count } = await serviceClient()
    .from("staff")
    .select("id", { count: "exact", head: true })
    .in("role", ["admin", "super_admin"])
    .eq("active", true);
  return count ?? 0;
}

/** Partial update of a staff profile. Omitted fields are left alone. */
export async function updateStaff(
  id: string,
  patch: { fullName?: string; role?: StaffRole; active?: boolean }
): Promise<Staff | null> {
  const row: Row = {};
  if (patch.fullName !== undefined) row.full_name = patch.fullName;
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.active !== undefined) row.active = patch.active;
  if (Object.keys(row).length === 0) return getStaffById(id);

  const { data, error } = await serviceClient()
    .from("staff")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapStaff(data) : null;
}
