import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { AuthError, requireStaff } from "@/lib/auth/staff";
import { applyCbtTransfer, planCbtTransfer, type ScorePart } from "@/lib/data/cbtTransfer";
import { listClasses } from "@/lib/data/classes";
import { getExam } from "@/lib/data/exams";
import { listSubjects } from "@/lib/data/subjects";
import { getTermById } from "@/lib/data/terms";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };
type Options = { termId: string; subjectId: string; part: ScorePart; overwrite: boolean; wholeMarks: boolean };

/**
 * Who may put this exam's results on the term sheet, and what it would do.
 * The same rules as entering term scores: a class teacher, for students in
 * their own classes (the class they sat in that term) and the current term
 * only; an admin, for anyone and any term.
 */
async function prepare(examId: string, o: Options) {
  const staff = await requireStaff();
  const [exam, term, classes, subjects] = await Promise.all([
    getExam(examId),
    o.termId ? getTermById(o.termId) : null,
    listClasses(),
    listSubjects(),
  ]);
  if (!exam) throw new AuthError("Exam not found", 404);
  if (exam.type !== "class") throw new AuthError("Only class tests go on term scores", 400);
  if (!term) throw new AuthError("Choose a term", 400);
  const subject = subjects.find((s) => s.id === o.subjectId);
  if (!subject) throw new AuthError("Choose a subject", 400);
  if (o.part !== "ca" && o.part !== "exam") throw new AuthError("Choose CA or exam", 400);

  const admin = isAdmin(staff.role);
  const mine = new Set(classes.filter((c) => c.classTeacherId === staff.id).map((c) => c.id));
  if (!admin && mine.size === 0) {
    throw new AuthError("Only an admin or a class teacher can put marks on term scores", 403);
  }
  // Exams have no subject of their own, so catch the likely slip: a title
  // naming one subject sent into another.
  const title = exam.title.toLowerCase();
  const named = subjects.filter((s) => title.includes(s.name.toLowerCase()));
  const subjectWarning =
    named.length > 0 && !named.some((s) => s.id === subject.id)
      ? `This test's title mentions ${named.map((s) => s.name).join(" / ")}, but you chose ${subject.name}.`
      : null;

  const rows = await planCbtTransfer({ examId, ...o, allowedClassIds: admin ? null : mine });
  return { rows, canSave: admin || term.isCurrent, subjectWarning };
}

const options = (get: (k: string) => unknown): Options => ({
  termId: String(get("termId") || ""),
  subjectId: String(get("subjectId") || ""),
  part: get("part") as ScorePart,
  overwrite: get("overwrite") === true || get("overwrite") === "1",
  wholeMarks: !(get("wholeMarks") === false || get("wholeMarks") === "0"),
});

/**
 * GET /api/exams/:id/send-to-scores?termId=&subjectId=&part=ca|exam&overwrite=1&wholeMarks=0
 * — the preview: every student's mark and what would happen. Writes nothing.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const sp = new URL(req.url).searchParams;
    return NextResponse.json(await prepare(id, options((k) => sp.get(k))));
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * POST /api/exams/:id/send-to-scores — save it: { termId, subjectId, part,
 * overwrite, wholeMarks } → { rows, saved }. Only add/replace rows are written.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) ?? {};
    const o = options((k) => body[k]);
    const plan = await prepare(id, o);
    if (!plan.canSave) throw new AuthError("Only an admin can change a past term's scores.", 403);
    const saved = await applyCbtTransfer({ termId: o.termId, subjectId: o.subjectId, part: o.part, rows: plan.rows });
    return NextResponse.json({ ...plan, saved });
  } catch (e) {
    return errorResponse(e);
  }
}
