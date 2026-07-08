import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { Attempt, ExamType, TakerType } from "@/lib/types";

type Row = Record<string, unknown>;

function mapAttempt(r: Row): Attempt {
  return {
    id: r.id as string,
    examId: r.exam_id as string,
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
  };
}

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
}): Promise<Attempt> {
  const { data, error } = await serviceClient()
    .from("attempts")
    .insert({
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
    })
    .select("*")
    .single();

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
  name?: string; // staff free-text search
  className?: string;
  year?: string;
  type?: ExamType;
};

export async function listAttempts(filter: AttemptFilter): Promise<Attempt[]> {
  let q = serviceClient()
    .from("attempts")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (filter.studentId) q = q.eq("student_id", filter.studentId);
  if (filter.name) q = q.ilike("taker_name", `%${filter.name}%`);
  if (filter.className) q = q.eq("class_name", filter.className);
  if (filter.year) q = q.eq("year", filter.year);
  if (filter.type) q = q.eq("exam_type", filter.type);

  const { data } = await q;
  return (data ?? []).map(mapAttempt);
}
