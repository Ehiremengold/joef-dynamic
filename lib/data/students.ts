import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import { generatePin, hashPin, verifyPin } from "@/lib/auth/pin";
import type { Page } from "@/lib/paging";
import type { ClassName, Student } from "@/lib/types";
import { clearStudent } from "./loginThrottle";
import { readPage } from "./paging";

type Row = Record<string, unknown>;

function mapStudent(r: Row): Student {
  return {
    id: r.id as string,
    admissionNumber: r.admission_number as string,
    fullName: r.full_name as string,
    className: r.class_name as ClassName,
    classId: (r.class_id as string | null) ?? null,
    entryYear: r.entry_year as string,
    gender: (r.gender as Student["gender"]) ?? null,
    dateOfBirth: (r.date_of_birth as string | null) ?? null,
    address: (r.address as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    active: r.active as boolean,
    createdAt: r.created_at as string,
  };
}

export type RosterFilter = {
  name?: string;
  /** A level, e.g. "JS1" (any campus or arm). */
  className?: string;
  /** One exact class, e.g. Obalende JS2A. */
  classId?: string;
  campusId?: string;
  /** The year they joined, e.g. "2026". */
  year?: string;
  status?: "active" | "inactive";
  /**
   * Only students in school during this session (or one term of it). For the
   * current session or term that is every active student; for a past one it
   * is everyone with results recorded then (every student who attended got
   * marks, and there's no other record of who was enrolled in a past term).
   */
  sessionId?: string;
  termId?: string;
};

/** Which students a session/term filter selects; see RosterFilter.sessionId. */
export type PeriodMatch = "at-school-now" | "had-results";

/** One page of the roster, A–Z. */
export async function listStudentsPage(
  filter: RosterFilter,
  page: number
): Promise<Page<Student> & { periodMatch: PeriodMatch | null }> {
  const supa = serviceClient();
  const byPeriod = Boolean(filter.termId || filter.sessionId);
  // Campus and session are filters on other tables: turn each into the ids
  // the students query can filter on. These lookups are tiny and run together.
  const [campusClassIds, periodTermIds, currentTerm] = await Promise.all([
    filter.campusId && !filter.classId
      ? supa.from("classes").select("id").eq("campus_id", filter.campusId).then(({ data }) => (data ?? []).map((c) => c.id as string))
      : null,
    filter.termId
      ? [filter.termId]
      : filter.sessionId
        ? supa.from("terms").select("id").eq("session_id", filter.sessionId).then(({ data }) => (data ?? []).map((t) => t.id as string))
        : null,
    byPeriod
      ? supa.from("terms").select("id, session_id").eq("is_current", true).maybeSingle().then(({ data }) => data)
      : null,
  ]);
  const isNow =
    byPeriod &&
    currentTerm !== null &&
    (filter.termId ? filter.termId === currentTerm.id : filter.sessionId === currentTerm.session_id);
  const periodMatch: PeriodMatch | null = !byPeriod ? null : isNow ? "at-school-now" : "had-results";
  // Results only matter for a past period; "now" is simply the active students.
  const termIds = periodMatch === "had-results" ? periodTermIds : null;
  // Nothing can match (a campus with no classes, a session with no terms).
  if (campusClassIds?.length === 0 || termIds?.length === 0) return { rows: [], total: 0, periodMatch };

  return readPage(
    (from, to) => {
      // "Had results in that period": an inner join on term_scores keeps only
      // students with at least one mark there, and the embedded rows are cut
      // to one so a student's 15 subjects don't all come back.
      const columns: string = termIds ? "*, term_scores!inner(term_id)" : "*";
      let q = supa.from("students").select(columns, { count: "exact" });
      if (termIds) q = q.in("term_scores.term_id", termIds).limit(1, { referencedTable: "term_scores" });
      if (filter.name) q = q.ilike("full_name", `%${filter.name}%`);
      if (filter.className) q = q.eq("class_name", filter.className);
      if (filter.classId) q = q.eq("class_id", filter.classId);
      if (campusClassIds) q = q.in("class_id", campusClassIds);
      if (filter.year) q = q.eq("entry_year", filter.year);
      if (filter.status) q = q.eq("active", filter.status === "active");
      if (periodMatch === "at-school-now") q = q.eq("active", true);
      return q
        .order("full_name", { ascending: true })
        // admission numbers are unique, so pages never overlap or skip anyone
        .order("admission_number", { ascending: true })
        .range(from, to)
        // The select string is built at runtime, so its row type can't be inferred.
        .overrideTypes<Row[], { merge: false }>();
    },
    page,
    mapStudent
  ).then((result) => ({ ...result, periodMatch }));
}

const ADMISSION_PREFIX = "JDCL-";

/**
 * Tidy a typed admission number: trimmed, upper case, no spaces around
 * dashes or slashes. The school's own numbers are padded to five digits, so
 * "jdcl - 1026" becomes "JDCL-01026".
 */
export function normaliseAdmissionNumber(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s*([-/])\s*/g, "$1").replace(/\s+/g, " ");
  const m = s.match(/^JDCL-?(\d{1,5})$/);
  return m ? `${ADMISSION_PREFIX}${m[1].padStart(5, "0")}` : s;
}

/** The number after the highest JDCL-NNNNN in use. */
export async function nextAdmissionNumber(): Promise<string> {
  const { data, error } = await serviceClient()
    .from("students")
    .select("admission_number")
    .like("admission_number", `${ADMISSION_PREFIX}_____`)
    .order("admission_number", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = Number(String(data?.[0]?.admission_number ?? "").slice(ADMISSION_PREFIX.length)) || 0;
  return `${ADMISSION_PREFIX}${String(last + 1).padStart(5, "0")}`;
}

/**
 * How alike two names are, in words. Spelling in the school's records
 * varies ("King-David" / "King David" / "KingDavid", "Adenyi" / "Adeniyi"),
 * so two words count as the same when they match once spaces and hyphens
 * are ignored, or when a longer word is one letter off.
 */
export function sharedNameWords(a: string, b: string): number {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z\s-]+/g, " ").split(/[\s-]+/).filter(Boolean);
  // Each word, plus each pair of neighbours joined ("king"+"david" = "kingdavid"),
  // remembering which of the name's words each token stands for.
  const tokens = (w: string[]) => [
    ...w.map((x, i) => ({ text: x, covers: [i] })).filter((t) => t.text.length >= 3),
    ...w.slice(1).map((x, i) => ({ text: w[i] + x, covers: [i, i + 1] })),
  ];
  const close = (x: string, y: string) => x === y || (Math.min(x.length, y.length) >= 5 && editDistanceAtMostOne(x, y));
  const theirs = tokens(words(b)).map((t) => t.text);
  const covered = new Set<number>();
  for (const t of tokens(words(a))) if (theirs.some((u) => close(t.text, u))) t.covers.forEach((i) => covered.add(i));
  // How many of the first name's words are accounted for in the second.
  return covered.size;
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Students whose name shares at least two words with this one (or all of
 * it, for a one-word name), allowing for the spelling differences above, so
 * "Adenyi KingDavid Adejare" finds "Adeniyi King David Adejare". Used to warn
 * before adding someone twice.
 */
export async function findSimilarStudents(fullName: string): Promise<Student[]> {
  // Two matching words, or the whole name when it is a single word.
  const need = Math.min(2, sharedNameWords(fullName, fullName));
  if (need === 0) return [];
  const supa = serviceClient();
  const matches: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from("students")
      .select("*, classes(level, arm, campuses(name))")
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) if (sharedNameWords(fullName, r.full_name as string) >= need) matches.push(r);
    if (!data || data.length < 1000) break;
  }
  return matches.slice(0, 5).map(mapStudent);
}

/**
 * Create a student in a class; returns the record plus the plaintext PIN
 * (shown once). With no admission number, the next JDCL number is used.
 */
export async function createStudent(input: {
  admissionNumber: string | null;
  fullName: string;
  classId: string;
  className: ClassName;
  entryYear: string;
  createdBy: string;
}): Promise<{ student: Student; pin: string }> {
  const pin = generatePin(6);
  const pin_hash = await hashPin(pin);
  // Two people adding at once can be handed the same next number; the
  // unique index refuses the second, so take the one after and try again.
  for (let attempt = 0; attempt < 5; attempt++) {
    const admissionNumber = input.admissionNumber ?? (await nextAdmissionNumber());
    const { data, error } = await serviceClient()
      .from("students")
      .insert({
        admission_number: admissionNumber,
        full_name: input.fullName,
        class_name: input.className,
        class_id: input.classId,
        entry_year: input.entryYear,
        pin_hash,
        created_by: input.createdBy,
      })
      .select("*")
      .single();
    if (!error) return { student: mapStudent(data), pin };
    if ((error as { code?: string }).code !== "23505") throw new Error(error.message);
    if (input.admissionNumber) throw new Error(`Admission number ${admissionNumber} is already in use`);
  }
  throw new Error("Could not find a free admission number. Try again.");
}

/** Who has this admission number already, if anyone. */
export async function getStudentByAdmissionNumber(admissionNumber: string): Promise<Student | null> {
  const { data } = await serviceClient().from("students").select("*").eq("admission_number", admissionNumber).maybeSingle();
  return data ? mapStudent(data) : null;
}

/** Reset a student's PIN; returns the new plaintext PIN. */
export async function resetStudentPin(id: string): Promise<string> {
  const pin = generatePin(6);
  const pin_hash = await hashPin(pin);
  const { data, error } = await serviceClient()
    .from("students")
    .update({ pin_hash })
    .eq("id", id)
    .select("admission_number")
    .single();
  if (error) throw new Error(error.message);
  // A new PIN also lifts any lock from wrong guesses at the old one.
  await clearStudent(data.admission_number as string);
  return pin;
}

/** Batch lookup, used to attach admission numbers to a list of attempts. */
export async function getStudentsByIds(ids: string[]): Promise<Student[]> {
  if (ids.length === 0) return [];
  const { data } = await serviceClient().from("students").select("*").in("id", ids);
  return (data ?? []).map(mapStudent);
}

export async function getStudentById(id: string): Promise<Student | null> {
  const { data } = await serviceClient()
    .from("students")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapStudent(data) : null;
}

/**
 * Assign a student to a real class (Class Management). Keeps the legacy
 * class_name in sync from the class's level so exam-eligibility matching,
 * which still keys off class_name, is unaffected.
 */
export async function assignStudentClass(
  id: string,
  classId: string,
  level: ClassName
): Promise<void> {
  const { error } = await serviceClient()
    .from("students")
    .update({ class_id: classId, class_name: level })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Remove a student's class assignment. Leaves the legacy class_name untouched
 * (it's NOT NULL and the exam system still reads it) — only the class_id link
 * to a real Class Management record is cleared.
 */
export async function unassignStudentClass(id: string): Promise<void> {
  const { error } = await serviceClient()
    .from("students")
    .update({ class_id: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setStudentActive(id: string, active: boolean): Promise<void> {
  const { error } = await serviceClient()
    .from("students")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Verify admission number + PIN for student login. */
// A real bcrypt hash of nothing in particular: checked against when the
// admission number doesn't exist, so a wrong number takes as long to refuse
// as a wrong PIN and can't be used to find out which numbers are real.
const NO_SUCH_STUDENT_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8DPrSPQrjWLFqvF3Fj1lPC3KqRUuG.";

export async function verifyStudentLogin(
  admissionNumber: string,
  pin: string
): Promise<Student | null> {
  const { data } = await serviceClient()
    .from("students")
    .select("*")
    .eq("admission_number", admissionNumber.trim())
    .eq("active", true)
    .maybeSingle();
  const ok = await verifyPin(pin, (data?.pin_hash as string | undefined) ?? NO_SUCH_STUDENT_HASH);
  return data && ok ? mapStudent(data) : null;
}
