import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import { ConflictError } from "@/lib/api";
import { examStatus } from "@/lib/examSchedule";
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
    // Missing until migration 0020 is run: no reviewing until then.
    reviewOpen: (r.review_open as boolean | undefined) ?? false,
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
  return examStatus(exam) === "scheduled";
}

/** Is the exam open right now (active + within any scheduled window)? */
export function isOpen(exam: Exam): boolean {
  return examStatus(exam) === "open";
}

// Every column, so review_open (0020) comes back once it exists without
// breaking the portal before the migration is run.
const EXAM_COLUMNS = "*";
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

/** These exams without their questions, by id (for what a list of results needs to know about each). */
export async function listExamsByIds(ids: string[]): Promise<Map<string, Exam>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await serviceClient().from("exams").select(EXAM_COLUMNS).in("id", [...new Set(ids)]);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((r) => [r.id as string, mapExam(r, [])]));
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
    /** A class test's class (JS1…SS3). */
    className?: ClassName;
    durationMins?: number;
    active?: boolean;
    /** ISO times; null clears that side of the schedule. */
    opensAt?: string | null;
    closesAt?: string | null;
    reviewOpen?: boolean;
  }
): Promise<void> {
  const row: Row = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.className !== undefined) row.class_name = patch.className;
  if (patch.durationMins !== undefined) row.duration_mins = patch.durationMins;
  if (patch.active !== undefined) row.active = patch.active;
  if (patch.opensAt !== undefined) row.opens_at = patch.opensAt;
  if (patch.closesAt !== undefined) row.closes_at = patch.closesAt;
  if (patch.reviewOpen !== undefined) row.review_open = patch.reviewOpen;
  if (Object.keys(row).length === 0) return;
  const { error } = await serviceClient().from("exams").update(row).eq("id", id);
  if (error) {
    if (patch.reviewOpen !== undefined && /review_open/.test(error.message)) {
      throw new Error("Letting students see their answers needs database update 0020. Ask the developer to run it.");
    }
    throw new Error(error.message);
  }
}

/**
 * Replace all of an exam's questions in one transaction (save_exam_questions,
 * migration 0022). `expectedIds` are the question ids the person saw, in
 * order: if the exam's questions have changed since (saved from another tab,
 * device or person), nothing is written and ConflictError says so. Null skips
 * the check, for a screen loaded before the check existed.
 */
export async function saveQuestions(
  examId: string,
  questions: { text: string; options: string[]; correctIndex: number }[],
  expectedIds: string[] | null
): Promise<void> {
  const { data, error } = await serviceClient().rpc("save_exam_questions", {
    p_exam_id: examId,
    p_expected: expectedIds,
    p_questions: questions,
  });
  if (error) {
    // PostgREST's "no such function": migration 0022 hasn't been run yet.
    if ((error as { code?: string }).code === "PGRST202") return saveQuestionsBeforeMigration(examId, questions, expectedIds);
    throw new Error(error.message);
  }
  const result = data as { saved?: number; conflict?: boolean; count?: number };
  if (result.conflict) throw questionsChanged(result.count ?? 0);
}

/**
 * Until migration 0022 is run, save as before it: the same check, then
 * delete and insert in two steps (not one transaction). Keeps question
 * saving working if the code goes live before the migration.
 */
async function saveQuestionsBeforeMigration(
  examId: string,
  questions: { text: string; options: string[]; correctIndex: number }[],
  expectedIds: string[] | null
): Promise<void> {
  console.warn("save_exam_questions is missing: run supabase/migrations/0022_save_exam_questions.sql");
  const supa = serviceClient();
  const { data: rows, error: readErr } = await supa
    .from("questions")
    .select("id")
    .eq("exam_id", examId)
    .order("position", { ascending: true })
    .order("id");
  if (readErr) throw new Error(readErr.message);
  const current = (rows ?? []).map((r) => r.id as string);
  if (expectedIds && (current.length !== expectedIds.length || current.some((id, i) => id !== expectedIds[i]))) {
    throw questionsChanged(current.length);
  }
  const { error: delErr } = await supa.from("questions").delete().eq("exam_id", examId);
  if (delErr) throw new Error(delErr.message);
  if (questions.length === 0) return;
  const { error } = await supa.from("questions").insert(
    questions.map((q, i) => ({ exam_id: examId, text: q.text, options: q.options, correct_index: q.correctIndex, position: i }))
  );
  if (error) throw new Error(error.message);
}

/** A save from a screen whose questions are out of date: told apart from other errors (409). */
export function questionsChanged(count: number): ConflictError {
  return new ConflictError(
    `This test was changed somewhere else (another tab, device or person) since you opened it, so this wasn't saved. ` +
      `It now has ${count} question${count === 1 ? "" : "s"}: check them below. Anything you typed is still here, so you can add it again.`,
    { questionsChanged: true }
  );
}

export async function deleteExam(id: string): Promise<void> {
  const { error } = await serviceClient().from("exams").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
