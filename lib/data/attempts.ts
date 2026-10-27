import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { Page } from "@/lib/paging";
import type { Attempt, AttemptQuestion, ExamType, TakerType } from "@/lib/types";
import { readPage } from "./paging";

type Row = Record<string, unknown>;

function mapAttempt(r: Row): Attempt {
  return {
    id: r.id as string,
    examId: (r.exam_id as string | null) ?? null,
    examTitle: r.exam_title as string,
    examType: r.exam_type as ExamType,
    takerType: r.taker_type as TakerType,
    studentId: (r.student_id as string | null) ?? null,
    candidateId: (r.candidate_id as string | null) ?? null,
    takerName: r.taker_name as string,
    className: (r.class_name as string | null) ?? null,
    year: r.year as string,
    answers: (r.answers as (number | null)[]) ?? [],
    score: r.score as number,
    total: r.total as number,
    submittedAt: r.submitted_at as string,
    questions: (r.questions as AttemptQuestion[] | null | undefined) ?? null,
  };
}

/**
 * The columns a list of results needs: not the question copy (questions,
 * 0020), which carries the correct answers and is only read for a review.
 */
const LIST_COLUMNS =
  "id, exam_id, exam_title, exam_type, taker_type, student_id, candidate_id, taker_name, class_name, year, answers, score, total, submitted_at";

export class DuplicateAttemptError extends Error {}

export async function insertAttempt(input: {
  examId: string;
  examTitle: string;
  examType: ExamType;
  takerType: TakerType;
  studentId: string | null;
  candidateId: string | null;
  takerName: string;
  className: string | null;
  year: string;
  answers: (number | null)[];
  score: number;
  total: number;
  /** The questions as they are now, kept with the result (0020). */
  questions: AttemptQuestion[];
}): Promise<Attempt> {
  const row = {
      exam_id: input.examId,
      exam_title: input.examTitle,
      exam_type: input.examType,
      taker_type: input.takerType,
      student_id: input.studentId,
      candidate_id: input.candidateId,
      taker_name: input.takerName,
      class_name: input.className,
      year: input.year,
      answers: input.answers,
      score: input.score,
      total: input.total,
      questions: input.questions,
  };
  let { data, error } = await serviceClient().from("attempts").insert(row).select("*").single();
  // Before migration 0020 there is nowhere to keep the questions: save the result without them
  // rather than lose a student's test.
  // PostgREST answers PGRST204 ("Could not find the 'questions' column"); Postgres itself 42703.
  const code = (error as { code?: string } | null)?.code;
  if (error && (code === "PGRST204" || code === "42703") && /questions/.test(error.message)) {
    const { questions: _q, ...withoutQuestions } = row;
    ({ data, error } = await serviceClient().from("attempts").insert(withoutQuestions).select("*").single());
  }

  if (error) {
    // 23505 = unique_violation → the taker already sat this exam
    if ((error as { code?: string }).code === "23505") {
      throw new DuplicateAttemptError("You have already taken this test");
    }
    throw new Error(error.message);
  }
  return mapAttempt(data);
}

export type AttemptFilter = {
  studentId?: string; // scope to one student (their own results)
  examId?: string; // scope to one exam (class mark sheet)
  name?: string; // staff free-text search
  className?: string;
  year?: string;
  type?: ExamType;
};

/**
 * The filtered, ordered attempts query; `count` adds the total a paged read
 * needs, and `withQuestions` the question copy (server-side use only).
 */
function attemptsQuery(filter: AttemptFilter, count?: "exact", withQuestions = false) {
  const columns: string = withQuestions ? "*" : LIST_COLUMNS;
  let q = serviceClient().from("attempts").select(columns, { count });

  if (filter.studentId) q = q.eq("student_id", filter.studentId);
  if (filter.examId) q = q.eq("exam_id", filter.examId);
  if (filter.name) q = q.ilike("taker_name", `%${filter.name}%`);
  if (filter.className) q = q.eq("class_name", filter.className);
  if (filter.year) q = q.eq("year", filter.year);
  if (filter.type) q = q.eq("exam_type", filter.type);

  // newest first; id breaks ties so pages never overlap or skip a result
  return q.order("submitted_at", { ascending: false }).order("id", { ascending: true });
}

/**
 * Has this taker already got a finished attempt for the exam? A count on the
 * one-attempt-per-taker unique index, so no rows come back.
 */
export async function hasAttempt(
  examId: string,
  taker: { kind: "student" | "candidate"; id: string }
): Promise<boolean> {
  const { count, error } = await serviceClient()
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId)
    .eq(taker.kind === "student" ? "student_id" : "candidate_id", taker.id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function listAttempts(filter: AttemptFilter, { withQuestions = false } = {}): Promise<Attempt[]> {
  // The column list is chosen at run time, so its row type can't be inferred.
  const { data } = await attemptsQuery(filter, undefined, withQuestions).overrideTypes<Row[], { merge: false }>();
  return (data ?? []).map(mapAttempt);
}

/** One page of results, newest first. */
export async function listAttemptsPage(filter: AttemptFilter, page: number): Promise<Page<Attempt>> {
  return readPage((from, to) => attemptsQuery(filter, "exact").range(from, to).overrideTypes<Row[], { merge: false }>(), page, mapAttempt);
}

/**
 * Staff only. Wipes a finished attempt so the taker may sit the exam again —
 * the recorded score is gone for good. Used when a sitting was lost to an
 * outage and the student needs a clean run at it.
 */
export async function deleteAttempt(id: string): Promise<void> {
  const { error } = await serviceClient().from("attempts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getAttemptById(id: string): Promise<Attempt | null> {
  const { data } = await serviceClient()
    .from("attempts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapAttempt(data) : null;
}
