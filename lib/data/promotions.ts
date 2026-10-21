import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import { classLabel } from "@/lib/classes";
import type { ClassName, Promotion, PromotionCandidate, PromotionOutcome } from "@/lib/types";

type Row = Record<string, unknown>;

/** Active students in the class who have not yet been moved into the session. */
export async function listPromotionCandidates(classId: string, sessionId: string): Promise<PromotionCandidate[]> {
  const supa = serviceClient();
  const { data: students, error } = await supa
    .from("students")
    .select("id, full_name, admission_number, entry_year")
    .eq("class_id", classId)
    .eq("active", true)
    .order("full_name");
  if (error) throw new Error(error.message);
  if (!students?.length) return [];
  // Includes students moved *into* this class for the session from below.
  const { data: moved, error: movedErr } = await supa
    .from("student_promotions")
    .select("student_id")
    .eq("session_id", sessionId)
    .in("student_id", students.map((s) => s.id as string));
  if (movedErr) throw new Error(movedErr.message);
  const done = new Set((moved ?? []).map((r) => r.student_id as string));
  return students
    .filter((s) => !done.has(s.id as string))
    .map((s) => ({
      id: s.id as string,
      fullName: s.full_name as string,
      admissionNumber: s.admission_number as string,
      entryYear: s.entry_year as string,
    }));
}

/**
 * How many students in each class still wait to be moved into the session:
 * active, not yet moved, and not new that session (a student who joined in
 * it is already in the right class, as the Promotion tab assumes). Classes
 * with nobody waiting are left out. For SS3 these are the students still to
 * graduate.
 */
export async function promotionProgress(sessionId: string, sessionStartYear: string): Promise<Map<string, number>> {
  const supa = serviceClient();
  // More students than one page of PostgREST rows: read them in pages.
  const students: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from("students")
      .select("id, class_id, entry_year")
      .eq("active", true)
      .not("class_id", "is", null)
      .lt("entry_year", sessionStartYear)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    students.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const moved = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from("student_promotions")
      .select("student_id")
      .eq("session_id", sessionId)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) moved.add(r.student_id as string);
    if ((data ?? []).length < 1000) break;
  }
  const waiting = new Map<string, number>();
  for (const st of students) {
    if (moved.has(st.id as string)) continue;
    const classId = st.class_id as string;
    waiting.set(classId, (waiting.get(classId) ?? 0) + 1);
  }
  return waiting;
}

/** Moves already made out of this class into the session, newest first. */
export async function listClassPromotions(classId: string, sessionId: string): Promise<Promotion[]> {
  const { data, error } = await serviceClient()
    .from("student_promotions")
    .select(
      "id, student_id, outcome, created_at, students(full_name, admission_number), " +
        "to_class:classes!student_promotions_to_class_id_fkey(level, arm, campuses(name))"
    )
    .eq("from_class_id", classId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const student = r.students as Row | null;
    const to = r.to_class as Row | null;
    return {
      id: r.id as string,
      studentId: r.student_id as string,
      fullName: (student?.full_name as string) ?? "",
      admissionNumber: (student?.admission_number as string) ?? "",
      outcome: r.outcome as PromotionOutcome,
      toClassLabel: to
        ? classLabel({
            campusName: (to.campuses as Row | null)?.name as string | undefined,
            level: to.level as ClassName,
            arm: (to.arm as string | null) ?? null,
          })
        : null,
      createdAt: r.created_at as string,
    };
  });
}

export type Move = { studentId: string; outcome: PromotionOutcome; toClassId: string | null };

/** Apply a class's moves in one transaction (see promote_students in 0015). */
export async function promoteStudents(sessionId: string, staffId: string, moves: Move[]): Promise<number> {
  const { data, error } = await serviceClient().rpc("promote_students", {
    p_session_id: sessionId,
    p_staff_id: staffId,
    p_moves: moves,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error("Some of these students were already moved into that session. Reload and try again.");
    }
    throw new Error(error.message);
  }
  return data as number;
}

export async function getPromotion(
  id: string
): Promise<{ id: string; fromClassId: string | null; promotedBy: string | null } | null> {
  const { data } = await serviceClient()
    .from("student_promotions")
    .select("id, from_class_id, promoted_by")
    .eq("id", id)
    .maybeSingle();
  return data
    ? {
        id: data.id as string,
        fromClassId: (data.from_class_id as string | null) ?? null,
        promotedBy: (data.promoted_by as string | null) ?? null,
      }
    : null;
}

/** Put the student back in the class (and active state) they had before. */
export async function undoPromotion(id: string): Promise<void> {
  const { error } = await serviceClient().rpc("undo_promotion", { p_promotion_id: id });
  if (error) throw new Error(error.message);
}
