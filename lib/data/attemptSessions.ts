import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { AttemptSession, Exam, TakerSession } from "@/lib/types";

type Row = Record<string, unknown>;

/**
 * Grace after the deadline in which a submit still counts as "on time". Covers
 * a slow network on the final POST, not a taker who wandered off.
 */
export const SUBMIT_GRACE_SECONDS = 60;

function mapSession(r: Row): AttemptSession {
  return {
    id: r.id as string,
    examId: r.exam_id as string,
    studentId: (r.student_id as string | null) ?? null,
    candidateId: (r.candidate_id as string | null) ?? null,
    takerName: r.taker_name as string,
    answers: (r.answers as (number | null)[]) ?? [],
    startedAt: r.started_at as string,
    extraSeconds: (r.extra_seconds as number) ?? 0,
    lastSeenAt: r.last_seen_at as string,
  };
}

/** Wall-clock end of a sitting, in epoch ms. The clock never pauses. */
export function deadlineMs(session: AttemptSession, exam: Exam): number {
  return (
    Date.parse(session.startedAt) +
    exam.durationMins * 60_000 +
    session.extraSeconds * 1000
  );
}

/** Whole seconds left, floored at zero. */
export function secondsLeft(session: AttemptSession, exam: Exam): number {
  return Math.max(0, Math.round((deadlineMs(session, exam) - Date.now()) / 1000));
}

export function isExpired(session: AttemptSession, exam: Exam): boolean {
  return Date.now() > deadlineMs(session, exam) + SUBMIT_GRACE_SECONDS * 1000;
}

function takerColumn(taker: TakerSession) {
  return taker.kind === "student"
    ? { student_id: taker.id, candidate_id: null }
    : { student_id: null, candidate_id: taker.id };
}

export async function getSession(
  examId: string,
  taker: TakerSession
): Promise<AttemptSession | null> {
  const col = taker.kind === "student" ? "student_id" : "candidate_id";
  const { data } = await serviceClient()
    .from("attempt_sessions")
    .select("*")
    .eq("exam_id", examId)
    .eq(col, taker.id)
    .maybeSingle();
  return data ? mapSession(data) : null;
}

/**
 * Resume the taker's sitting, or start the clock if this is their first look at
 * the exam. Racing tabs both land on the same row thanks to the partial unique
 * index — the insert conflicts and we re-read rather than restarting the clock.
 */
export async function startOrResume(
  exam: Exam,
  taker: TakerSession
): Promise<AttemptSession> {
  const existing = await getSession(exam.id, taker);
  if (existing) return existing;

  const { data, error } = await serviceClient()
    .from("attempt_sessions")
    .insert({
      exam_id: exam.id,
      ...takerColumn(taker),
      taker_name: taker.name,
      answers: exam.questions.map(() => null),
    })
    .select("*")
    .single();

  if (error) {
    // 23505 = unique_violation → a parallel tab created it first.
    if ((error as { code?: string }).code === "23505") {
      const raced = await getSession(exam.id, taker);
      if (raced) return raced;
    }
    throw new Error(error.message);
  }
  return mapSession(data);
}

/** Autosave. Answers are normalised against the exam so a stale tab can't grow the array. */
export async function saveAnswers(
  sessionId: string,
  exam: Exam,
  answers: unknown
): Promise<(number | null)[]> {
  const normalised = exam.questions.map((_, i) => {
    const a = Array.isArray(answers) ? answers[i] : null;
    return Number.isInteger(a) ? (a as number) : null;
  });
  const { error } = await serviceClient()
    .from("attempt_sessions")
    .update({ answers: normalised, last_seen_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
  return normalised;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await serviceClient().from("attempt_sessions").delete().eq("id", sessionId);
}

/** Staff: every sitting currently in flight for an exam. */
export async function listSessionsForExam(
  examId: string
): Promise<AttemptSession[]> {
  const { data } = await serviceClient()
    .from("attempt_sessions")
    .select("*")
    .eq("exam_id", examId)
    .order("started_at", { ascending: true });
  return (data ?? []).map(mapSession);
}

/** Staff override: hand back time lost to a genuine outage. */
export async function grantExtraSeconds(
  sessionId: string,
  seconds: number
): Promise<void> {
  const { data } = await serviceClient()
    .from("attempt_sessions")
    .select("extra_seconds")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data) throw new Error("That sitting has already finished");
  const next = Math.max(0, ((data.extra_seconds as number) ?? 0) + seconds);
  const { error } = await serviceClient()
    .from("attempt_sessions")
    .update({ extra_seconds: next })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}
