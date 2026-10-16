import "server-only";
import { authClient } from "@/lib/supabase/serverAuth";
import { serviceClient } from "@/lib/supabase/server";
import { isAdmin, isSuperAdmin } from "@/lib/roles";
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

const STAFF_COLUMNS = "id, full_name, email, role, active, created_at";

/**
 * Resolve the signed-in staff member from the Supabase Auth session, or null.
 * Confirms the user still has an active staff profile.
 *
 * getClaims() verifies the session token's signature and expiry. With the
 * project's asymmetric JWT signing keys turned on it does so locally, with no
 * call to Supabase Auth; with the older shared-secret keys it asks Supabase
 * (the same call getUser() made), so it is never slower.
 */
export async function currentStaff(): Promise<Staff | null> {
  const supa = await authClient();
  const { data: auth } = await supa.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const { data } = await serviceClient()
    .from("staff")
    .select(STAFF_COLUMNS)
    .eq("id", userId)
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
  if (!isAdmin(staff.role)) throw new AuthError("Admins only", 403);
  return staff;
}

export async function requireSuperAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (!isSuperAdmin(staff.role)) throw new AuthError("Super admins only", 403);
  return staff;
}
