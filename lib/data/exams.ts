import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type {
  ClassName,
  Exam,
  ExamType,
  PublicExam,
  Question,
} from "@/lib/types";

type Row = Record<string, unknown>;

function mapQuestion(r: Row): Question {
  return {
    id: r.id as string,
    text: r.text as string,
    options: (r.options as string[]) ?? [],
    correctIndex: r.correct_index as number,
    position: (r.position as number) ?? 0,
  };
}

function mapExam(r: Row, questions: Question[]): Exam {
  return {
    id: r.id as string,
    type: r.type as ExamType,
    className: (r.class_name as ClassName | null) ?? null,
    title: r.title as string,
    durationMins: r.duration_mins as number,
    active: r.active as boolean,
    opensAt: (r.opens_at as string | null) ?? null,
    closesAt: (r.closes_at as string | null) ?? null,
    createdBy: (r.created_by as string | null) ?? null,
    createdAt: r.created_at as string,
    questions,
  };
}

/** Strip correct answers for anything sent to a test taker. */
export function toPublicExam(exam: Exam): PublicExam {
  return {
    ...exam,
    questions: exam.questions.map(({ correctIndex: _c, ...q }) => q),
  };
}

/** Is the exam open right now (active + within any scheduled window)? */
export function isOpen(exam: Exam): boolean {
  if (!exam.active) return false;
  const now = Date.now();
  if (exam.opensAt && now < Date.parse(exam.opensAt)) return false;
  if (exam.closesAt && now > Date.parse(exam.closesAt)) return false;
  return true;
}

async function loadQuestions(examIds: string[]): Promise<Map<string, Question[]>> {
  const map = new Map<string, Question[]>();
  if (examIds.length === 0) return map;
  const { data } = await serviceClient()
    .from("questions")
    .select("*")
    .in("exam_id", examIds)
    .order("position", { ascending: true });
  for (const r of data ?? []) {
    const eid = r.exam_id as string;
    if (!map.has(eid)) map.set(eid, []);
    map.get(eid)!.push(mapQuestion(r));
  }
  return map;
}

export async function listExams(filter: {
  type?: ExamType;
  className?: string;
}): Promise<Exam[]> {
  let q = serviceClient().from("exams").select("*").order("created_at", {
    ascending: false,
  });
  if (filter.type) q = q.eq("type", filter.type);
  if (filter.className) q = q.eq("class_name", filter.className);
  const { data } = await q;
  const rows = data ?? [];
  const qmap = await loadQuestions(rows.map((r) => r.id as string));
  return rows.map((r) => mapExam(r, qmap.get(r.id as string) ?? []));
}

export async function getExam(id: string): Promise<Exam | null> {
  const { data } = await serviceClient()
    .from("exams")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const qmap = await loadQuestions([id]);
  return mapExam(data, qmap.get(id) ?? []);
}

export async function createExam(input: {
  type: ExamType;
  className: string | null;
  title: string;
  durationMins: number;
  createdBy: string;
}): Promise<Exam> {
  const { data, error } = await serviceClient()
    .from("exams")
    .insert({
      type: input.type,
      class_name: input.type === "class" ? input.className : null,
      title: input.title,
      duration_mins: input.durationMins,
      active: false,
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapExam(data, []);
}

export async function updateExamMeta(
  id: string,
  patch: { title?: string; durationMins?: number; active?: boolean }
): Promise<void> {
  const row: Row = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.durationMins !== undefined) row.duration_mins = patch.durationMins;
  if (patch.active !== undefined) row.active = patch.active;
  if (Object.keys(row).length === 0) return;
  const { error } = await serviceClient().from("exams").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Replace all questions for an exam in one transaction-like swap. */
export async function replaceQuestions(
  examId: string,
  questions: { text: string; options: string[]; correctIndex: number }[]
): Promise<void> {
  const supa = serviceClient();
  const { error: delErr } = await supa
    .from("questions")
    .delete()
    .eq("exam_id", examId);
  if (delErr) throw new Error(delErr.message);
  if (questions.length === 0) return;
  const rows = questions.map((q, i) => ({
    exam_id: examId,
    text: q.text,
    options: q.options,
    correct_index: q.correctIndex,
    position: i,
  }));
  const { error } = await supa.from("questions").insert(rows);
  if (error) throw new Error(error.message);
}

export async function deleteExam(id: string): Promise<void> {
  const { error } = await serviceClient().from("exams").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
