import "server-only";
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

export async function setStaffActive(id: string, active: boolean): Promise<void> {
  const { error } = await serviceClient()
    .from("staff")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
