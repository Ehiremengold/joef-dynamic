import "server-only";
import { authClient } from "@/lib/supabase/serverAuth";
import { serviceClient } from "@/lib/supabase/server";
import type { Staff, StaffRole } from "@/lib/types";

function mapStaff(row: Record<string, unknown>): Staff {
  return {
    id: row.id as string,
    fullName: row.full_name as string,
    email: row.email as string,
    role: row.role as StaffRole,
    active: row.active as boolean,
    createdAt: row.created_at as string,
  };
}

/**
 * Resolve the signed-in staff member from the Supabase Auth session, or null.
 * Confirms the user still has an active staff profile.
 */
export async function currentStaff(): Promise<Staff | null> {
  const supa = await authClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return null;

  const { data } = await serviceClient()
    .from("staff")
    .select("*")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();

  return data ? mapStaff(data) : null;
}

/** Throwing guards for use at the top of API routes. */
export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireStaff(): Promise<Staff> {
  const staff = await currentStaff();
  if (!staff) throw new AuthError("Staff sign-in required", 401);
  return staff;
}

export async function requireAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== "admin") throw new AuthError("Admins only", 403);
  return staff;
}
