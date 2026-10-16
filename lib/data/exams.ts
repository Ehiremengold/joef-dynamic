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

/** Not yet open, but switched on and scheduled: students see it coming up. */
export function isUpcoming(exam: Exam): boolean {
  return exam.active && exam.opensAt !== null && Date.now() < Date.parse(exam.opensAt);
}

/** Is the exam open right now (active + within any scheduled window)? */
export function isOpen(exam: Exam): boolean {
  if (!exam.active) return false;
  const now = Date.now();
  if (exam.opensAt && now < Date.parse(exam.opensAt)) return false;
  if (exam.closesAt && now > Date.parse(exam.closesAt)) return false;
  return true;
}

const EXAM_COLUMNS =
  "id, type, class_name, title, duration_mins, active, opens_at, closes_at, created_by, created_at";
const QUESTION_COLUMNS = "id, exam_id, text, options, correct_index, position";
// Supabase returns at most 1000 rows per select; read questions a page at a time.
const QUESTION_PAGE = 1000;

/** Every question of these exams, in order, grouped by exam. */
async function loadQuestions(examIds: string[]): Promise<Map<string, Question[]>> {
  const map = new Map<string, Question[]>();
  if (examIds.length === 0) return map;
  for (let from = 0; ; from += QUESTION_PAGE) {
    const { data, error } = await serviceClient()
      .from("questions")
      .select(QUESTION_COLUMNS)
      .in("exam_id", examIds)
      .order("exam_id")
      .order("position", { ascending: true })
      .order("id")
      .range(from, from + QUESTION_PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const eid = r.exam_id as string;
      if (!map.has(eid)) map.set(eid, []);
      map.get(eid)!.push(mapQuestion(r));
    }
    if (!data || data.length < QUESTION_PAGE) return map;
  }
}

export async function listExams(filter: {
  type?: ExamType;
  className?: string;
  /** Takers only ever see active exams, so don't load the rest's questions. */
  activeOnly?: boolean;
}): Promise<Exam[]> {
  let q = serviceClient().from("exams").select(EXAM_COLUMNS).order("created_at", {
    ascending: false,
  });
  if (filter.type) q = q.eq("type", filter.type);
  if (filter.className) q = q.eq("class_name", filter.className);
  if (filter.activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const qmap = await loadQuestions(rows.map((r) => r.id as string));
  return rows.map((r) => mapExam(r, qmap.get(r.id as string) ?? []));
}

export async function getExam(id: string): Promise<Exam | null> {
  // The exam and its questions don't depend on each other: fetch both at once.
  const [{ data }, qmap] = await Promise.all([
    serviceClient().from("exams").select(EXAM_COLUMNS).eq("id", id).maybeSingle(),
    loadQuestions([id]),
  ]);
  if (!data) return null;
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
  patch: {
    title?: string;
    durationMins?: number;
    active?: boolean;
    /** ISO times; null clears that side of the schedule. */
    opensAt?: string | null;
    closesAt?: string | null;
  }
): Promise<void> {
  const row: Row = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.durationMins !== undefined) row.duration_mins = patch.durationMins;
  if (patch.active !== undefined) row.active = patch.active;
  if (patch.opensAt !== undefined) row.opens_at = patch.opensAt;
  if (patch.closesAt !== undefined) row.closes_at = patch.closesAt;
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
