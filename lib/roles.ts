import type { Exam, StaffRole } from "./types";

export const ROLE_LABELS: Record<StaffRole, string> = {
  teacher: "Teacher",
  admin: "Administrator",
  super_admin: "Super admin",
};

/** Admins and super admins: staff, students, classes, every exam. */
export const isAdmin = (role: StaffRole): boolean => role === "admin" || role === "super_admin";

/** Approves deletions of other people's work, and decides who else is a super admin. */
export const isSuperAdmin = (role: StaffRole): boolean => role === "super_admin";

/**
 * What a staff member may do with an exam.
 * - manage: everything, including deleting it, removing questions and
 *   clearing results — the exam's creator, or a super admin.
 * - contribute: an admin on someone else's exam. They can add questions,
 *   open/close it and grant extra time, but deleting it or removing its
 *   questions is a request a super admin approves.
 * - view: a teacher on someone else's exam. They can look and download
 *   results, nothing more.
 */
export type ExamAccess = "manage" | "contribute" | "view";

export function examAccess(staff: { id: string; role: StaffRole }, exam: Pick<Exam, "createdBy">): ExamAccess {
  if (isSuperAdmin(staff.role) || exam.createdBy === staff.id) return "manage";
  return isAdmin(staff.role) ? "contribute" : "view";
}
