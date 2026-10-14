import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import { deleteExam, getExam, replaceQuestions } from "./exams";

type Row = Record<string, unknown>;

export type DeletionRequest = {
  id: string;
  examId: string | null;
  examTitle: string;
  /** Null when the whole exam is to be deleted. */
  questionText: string | null;
  reason: string;
  requestedBy: string | null;
  status: "pending" | "approved" | "rejected" | "obsolete";
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

const SELECT = "*, requester:staff!requested_by(full_name), decider:staff!decided_by(full_name)";

function map(r: Row): DeletionRequest {
  return {
    id: r.id as string,
    examId: (r.exam_id as string | null) ?? null,
    examTitle: r.exam_title as string,
    questionText: (r.question_text as string | null) ?? null,
    reason: r.reason as string,
    requestedBy: ((r.requester as Row | null)?.full_name as string | undefined) ?? null,
    status: r.status as DeletionRequest["status"],
    decidedBy: ((r.decider as Row | null)?.full_name as string | undefined) ?? null,
    decidedAt: (r.decided_at as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

/** Pending requests first, then the most recent decisions. `requestedBy` narrows to one person's requests. */
export async function listDeletionRequests(filter: { requestedBy?: string } = {}): Promise<DeletionRequest[]> {
  let q = serviceClient().from("deletion_requests").select(SELECT).order("created_at", { ascending: false }).limit(50);
  if (filter.requestedBy) q = q.eq("requested_by", filter.requestedBy);
  const { data } = await q;
  const all = (data ?? []).map(map);
  return [...all.filter((r) => r.status === "pending"), ...all.filter((r) => r.status !== "pending")];
}

export async function createDeletionRequest(input: {
  examId: string;
  examTitle: string;
  question: { text: string; options: string[] } | null;
  reason: string;
  requestedBy: string;
}): Promise<void> {
  const supa = serviceClient();
  // One open request per thing is enough.
  let existing = supa
    .from("deletion_requests")
    .select("id")
    .eq("exam_id", input.examId)
    .eq("status", "pending");
  existing = input.question ? existing.eq("question_text", input.question.text) : existing.is("question_text", null);
  const { data: dupe } = await existing.limit(1).maybeSingle();
  if (dupe) throw new Error("A request to delete this is already waiting for approval");

  const { error } = await supa.from("deletion_requests").insert({
    exam_id: input.examId,
    exam_title: input.examTitle,
    question_text: input.question?.text ?? null,
    question_options: input.question?.options ?? null,
    reason: input.reason,
    requested_by: input.requestedBy,
  });
  if (error) throw new Error(error.message);
}

/**
 * A super admin's decision. Approving carries out the deletion. If the exam
 * or question is already gone, or the question has since been changed, the
 * request is closed as obsolete and nothing is deleted.
 */
export async function decideDeletionRequest(
  id: string,
  approve: boolean,
  decidedBy: string
): Promise<DeletionRequest["status"]> {
  const supa = serviceClient();
  const { data: r } = await supa.from("deletion_requests").select("*").eq("id", id).eq("status", "pending").maybeSingle();
  if (!r) throw new Error("That request is no longer pending");

  let status: DeletionRequest["status"] = approve ? "approved" : "rejected";
  if (approve) {
    const exam = r.exam_id ? await getExam(r.exam_id as string) : null;
    if (!exam) status = "obsolete";
    else if (!r.question_text) await deleteExam(exam.id);
    else {
      const options = JSON.stringify(r.question_options);
      const index = exam.questions.findIndex(
        (q) => q.text === r.question_text && JSON.stringify(q.options) === options
      );
      if (index < 0) status = "obsolete";
      else await replaceQuestions(exam.id, exam.questions.filter((_, i) => i !== index));
    }
  }

  const { error } = await supa
    .from("deletion_requests")
    .update({ status, decided_by: decidedBy, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return status;
}
