/**
 * Import the legacy school-management export (the folder of .xlsx workbooks)
 * into the portal database. Run after migration 0009.
 *
 *   node scripts/import-legacy-export.mjs <export-dir>            # dry run
 *   node scripts/import-legacy-export.mjs <export-dir> --apply    # write
 *
 * A dry run needs no database: it parses and checks the workbooks, prints
 * what would be loaded, and writes every row that needs a human look to
 * import-output/review.csv.
 *
 * --apply is insert-only and safe to re-run: rows that already exist
 * (matched on admission number, email, class, subject, term…) are left
 * exactly as they are, so nothing edited in the portal is ever overwritten.
 * New students get a generated PIN and new staff a generated password; the
 * plaintext is written once to import-output/ (gitignored) for hand-out.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { randomBytes, randomInt } from "node:crypto";
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ws from "ws";

// Node < 22 has no global WebSocket; supabase-js needs one at construct time.
if (typeof globalThis.WebSocket === "undefined") globalThis.WebSocket = ws;

// ------------------------------------------------------------------
// Decisions about the legacy data — change these, not the code below.
// ------------------------------------------------------------------

// Classes tagged "Ikoyi" in their name belong to Ikoyi; every other class
// (the A/B/C and Gold/Silver arms) belongs to Obalende.
const IKOYI = "Ikoyi";
const OBALENDE = "Obalende";

const LEVEL_PREFIX = { JSS: "JS", SSS: "SS", BASIC: "BS", NURSERY: "NUR", KG: "KG" };

// Placeholder classes whose students and scores are left out.
const SKIP_CLASSES = new Set(["SAMPLE CLASS"]);

// Spellings of the same subject. Only the unambiguous ones are merged here;
// looser pairs (Rhyme/Rhymes, Security/Security Education, Coding/Robotics)
// are imported as they are and can be tidied in the portal.
const SUBJECT_ALIASES = {
  "Christain Religious Studies": "Christian Religious Studies",
  "Cultural Amp Creative Arts": "Cultural and Creative Arts",
  "Coding Amp Robotics": "Coding & Robotics",
  "Coding Robotics": "Coding & Robotics",
};

// Test logins in the Admins sheet.
const SKIP_STAFF_EMAILS = new Set(["admine@gmail.com", "adminz@gmail.com"]);

const TERM_NAMES = { FIRST: "First Term", SECOND: "Second Term", THIRD: "Third Term" };

// ------------------------------------------------------------------
// Workbook reading
// ------------------------------------------------------------------

function cellValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return cellValue(v.richText.map((t) => t.text).join(""));
    if ("result" in v) return cellValue(v.result);
    if ("text" in v) return cellValue(v.text);
    return null;
  }
  if (typeof v === "string") {
    const t = v.replace(/\s+/g, " ").trim();
    return t === "" ? null : t;
  }
  return v;
}

async function openWorkbook(path) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  return wb;
}

/** Non-empty rows of a worksheet as plain arrays (0-indexed columns). */
function sheetRows(sheet) {
  const out = [];
  sheet.eachRow((row) => {
    const cells = [];
    for (let c = 1; c <= sheet.columnCount; c++) {
      // A merged cell reports its master's value in every column; keep it once.
      const cell = row.getCell(c);
      cells.push(cell.isMerged && cell.master !== cell ? null : cellValue(cell.value));
    }
    if (cells.some((c) => c !== null)) out.push(cells);
  });
  return out;
}

/** Rows of a named sheet as objects keyed by the header row. */
function sheetRecords(wb, name) {
  const sheet = wb.getWorksheet(name);
  if (!sheet) throw new Error(`Sheet "${name}" not found`);
  const [header, ...rows] = sheetRows(sheet);
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? null])));
}

// ------------------------------------------------------------------
// Normalisers
// ------------------------------------------------------------------

const text = (v) => (v === null || v === undefined ? null : String(v).trim() || null);
const nameKey = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const joinName = (...parts) =>
  parts
    .map(text)
    .filter(Boolean)
    .join(" ")
    .replace(/\s*,\s*$/g, "")
    .replace(/\s+/g, " ");

/** "2025 - 2026" or "2025-2026" → "2025/2026" */
function sessionName(raw) {
  const m = String(raw).match(/(\d{4})\D+(\d{4})/);
  if (!m) throw new Error(`Unrecognised session "${raw}"`);
  return `${m[1]}/${m[2]}`;
}

/** "FIRST", "FIRST TERM" → "First Term" */
function termName(raw) {
  const name = TERM_NAMES[String(raw).trim().toUpperCase().split(/\s+/)[0]];
  if (!name) throw new Error(`Unrecognised term "${raw}"`);
  return name;
}

/** "JSS 2 (Ikoyi)" → { campus: "Ikoyi", level: "JS2", arm: null } */
function parseClass(raw) {
  const m = String(raw)
    .toUpperCase()
    .match(/^(JSS|SSS|BASIC|NURSERY|KG)\s*(\d)\s*(.*)$/);
  if (!m) return null;
  const level = `${LEVEL_PREFIX[m[1]]}${m[2]}`;
  const rest = m[3].replace(/[()]/g, "").trim();
  if (rest === "IKOYI") return { campus: IKOYI, level, arm: null };
  const arm = rest === "" ? null : rest.length === 1 ? rest : rest[0] + rest.slice(1).toLowerCase();
  return { campus: OBALENDE, level, arm };
}

const classKey = (c) => `${c.campus}|${c.level}|${c.arm ?? ""}`;
const subjectName = (raw) => SUBJECT_ALIASES[raw] ?? raw;
const validEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

/** Keep only plausible birth dates; the export has typos and placeholders. */
function birthDate(raw) {
  const s = text(raw);
  if (!s) return { value: null, bad: false };
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const year = m ? Number(m[1]) : 0;
  if (!m || year < 1990 || year > new Date().getFullYear()) return { value: null, bad: true };
  return { value: s, bad: false };
}

// ------------------------------------------------------------------
// Build the plan — everything the export says, normalised, no database.
// ------------------------------------------------------------------

async function buildPlan(dir) {
  const review = [];
  const flag = (kind, ref, detail) => review.push({ kind, ref, detail });

  const structure = await openWorkbook(join(dir, "School-Structure.xlsx"));
  const users = await openWorkbook(join(dir, "Users.xlsx"));
  const calendar = await openWorkbook(join(dir, "Sessions-and-Terms.xlsx"));

  // --- sessions & terms
  const sessions = sheetRecords(calendar, "Sessions").map((r) => sessionName(r["Session"]));
  sessions.sort();
  const terms = sheetRecords(calendar, "Terms").map((r) => ({
    session: sessionName(r["Session"]),
    name: termName(r["Term"]),
  }));
  // The export flags a "current" term in every session; only the latest counts.
  const currentSession = sessions[sessions.length - 1];
  const currentTerm = sheetRecords(calendar, "Terms")
    .filter((r) => sessionName(r["Session"]) === currentSession && r["Current Term"] === "Yes")
    .map((r) => termName(r["Term"]))[0];

  // --- classes
  const classByRawName = new Map(); // raw export name → class | null (skipped)
  const classes = new Map(); // classKey → class
  for (const r of sheetRecords(structure, "Classes & Arms")) {
    const raw = r["Class"];
    if (SKIP_CLASSES.has(raw)) {
      classByRawName.set(raw, null);
      continue;
    }
    const cls = parseClass(raw);
    if (!cls) throw new Error(`Unrecognised class "${raw}"`);
    if (classes.has(classKey(cls))) throw new Error(`Two classes map to ${classKey(cls)}`);
    classes.set(classKey(cls), cls);
    classByRawName.set(raw, cls);
  }

  // --- subjects & what each class offers this session
  const subjects = new Set(sheetRecords(structure, "Subjects").map((r) => subjectName(r["Subject"])));
  const classSubjects = new Set(); // "classKey::subject"
  for (const r of sheetRecords(structure, "Class Subjects")) {
    if (sessionName(r["Session"]) !== currentSession) continue;
    const cls = classByRawName.get(r["Class"]);
    if (!cls) continue;
    classSubjects.add(`${classKey(cls)}::${subjectName(r["Subject"])}`);
  }

  // --- students
  const students = new Map(); // admission number → student
  const studentsWithoutAdmission = new Map(); // nameKey → student
  const skippedStudents = new Set(); // admission numbers / name keys left out on purpose
  for (const r of sheetRecords(users, "Students")) {
    const fullName = joinName(r["First Name"], r["Middle Name"], r["Last Name"]);
    const ownNumber = text(r["Admission No"]);
    const admissionNumber = ownNumber ?? text(r["Examination No"]);
    const cls = classByRawName.get(r["Current Class"]);
    if (cls === null) {
      skippedStudents.add(admissionNumber ?? nameKey(fullName));
      flag("student-skipped-placeholder-class", admissionNumber, `${fullName} — ${r["Current Class"]}`);
      continue;
    }
    if (!cls) throw new Error(`Student ${admissionNumber} is in unknown class "${r["Current Class"]}"`);
    if (!admissionNumber) {
      flag("student-skipped-no-number", fullName, "No admission or examination number");
      continue;
    }
    if (students.has(admissionNumber)) {
      flag("student-skipped-duplicate-number", admissionNumber, fullName);
      continue;
    }
    if (!ownNumber || !/^JDCL-\d{5}$/.test(ownNumber)) {
      flag(
        "student-admission-number",
        admissionNumber,
        `${fullName} — admission "${ownNumber ?? ""}", examination "${text(r["Examination No"]) ?? ""}"; using "${admissionNumber}"`
      );
    }
    const dob = birthDate(r["Date of Birth"]);
    if (dob.bad) flag("student-birth-date-dropped", admissionNumber, `${fullName} — "${r["Date of Birth"]}"`);
    const student = {
      admissionNumber,
      fullName,
      cls,
      active: r["Status"] === "Active" && r["Active"] === "Yes",
      gender: r["Gender"] ? String(r["Gender"]).toLowerCase() : null,
      dateOfBirth: dob.value,
      address: text(r["Address"]),
      phone: text(r["Phone Number"]),
      entryYear: null,
    };
    students.set(admissionNumber, student);
    if (!ownNumber) studentsWithoutAdmission.set(nameKey(fullName), student);
  }

  // --- parents
  const parents = new Map(); // email → parent
  for (const r of sheetRecords(users, "Parents")) {
    let title = text(r["Title"]);
    let first = text(r["First Name"]);
    // One row has the title typed into the first-name column.
    if (!title && first && /^(mr|mrs|miss|ms|dr)\.?$/i.test(first)) [title, first] = [first, null];
    const fullName = joinName(first, r["Middle Name"], r["Last Name"]);
    const email = text(r["Email"])?.toLowerCase() ?? null;
    if (!email || !fullName) {
      flag("parent-skipped", email ?? fullName, "Missing name or email");
      continue;
    }
    if (parents.has(email)) {
      flag("parent-skipped-duplicate-email", email, fullName);
      continue;
    }
    const children = [];
    for (const part of String(r["Children"] ?? "").split(";").map((p) => p.trim()).filter(Boolean)) {
      const m = part.match(/^(.*)\(([^()]*)\)$/);
      const number = m?.[2].trim();
      const childName = (m?.[1] ?? part).trim();
      const child = number ? students.get(number) : studentsWithoutAdmission.get(nameKey(childName));
      if (child) children.push(child.admissionNumber);
      else if (!skippedStudents.has(number)) flag("parent-child-not-found", email, part);
    }
    parents.set(email, {
      title,
      fullName,
      email,
      phone: text(r["Phone Number"]),
      address: text(r["Address"]),
      active: r["Active"] === "Yes",
      children,
    });
  }

  // --- staff: active teachers, plus admins (some people are on both sheets)
  const staff = new Map(); // email → staff
  const addStaff = (r, role) => {
    const fullName = joinName(r["First Name"], r["Middle Name"], r["Last Name"]);
    const email = text(r["Email"])?.toLowerCase() ?? "";
    if (SKIP_STAFF_EMAILS.has(email)) return flag("staff-skipped-test-account", email, fullName);
    if (r["Active"] !== "Yes") return flag("staff-skipped-inactive", email, fullName);
    if (!validEmail(email)) return flag("staff-skipped-bad-email", email, fullName);
    const existing = staff.get(email);
    if (existing) existing.role = role === "admin" ? "admin" : existing.role;
    else staff.set(email, { fullName, email, role });
  };
  for (const r of sheetRecords(users, "Teachers")) addStaff(r, "teacher");
  for (const r of sheetRecords(users, "Admins")) addStaff(r, "admin");

  // --- term scores
  const scores = new Map(); // "admission|subject|session|term" → score
  const tally = { blank: 0, placeholderClass: 0 };
  const gradeDir = join(dir, "Grades");
  for (const file of readdirSync(gradeDir).filter((f) => f.endsWith(".xlsx")).sort()) {
    const session = sessionName(file);
    if (!sessions.includes(session)) throw new Error(`${file}: session ${session} is not in Sessions-and-Terms`);
    const wb = await openWorkbook(join(gradeDir, file));
    for (const sheet of wb.worksheets) {
      const term = termName(sheet.name.split(" - ")[0]);
      const [header, ...rows] = sheetRows(sheet);
      const caMax = Number(String(header[2]).match(/^CA \((\d+)\)$/)?.[1]);
      const examMax = Number(String(header[3]).match(/^EXAM \((\d+)\)$/)?.[1]);
      if (!caMax || !examMax || header[4] !== "Total") {
        throw new Error(`${file} / ${sheet.name}: unexpected columns ${JSON.stringify(header)}`);
      }
      let cls;
      let subject;
      for (const [number, studentName, ca, exam, total] of rows) {
        const where = `${session} ${term} — ${cls ? classKey(cls) : "?"} — ${subject}`;
        if (studentName === null && ca === null && exam === null && total === null) {
          // Group heading: "<class> - <subject>"
          const raw = [...classByRawName.keys()].find((c) => String(number).startsWith(`${c} - `));
          if (raw === undefined) throw new Error(`${file} / ${sheet.name}: unrecognised heading "${number}"`);
          cls = classByRawName.get(raw);
          subject = subjectName(String(number).slice(raw.length + 3));
          if (!subjects.has(subject)) throw new Error(`${file}: subject "${subject}" is not in the subject list`);
          continue;
        }
        if (cls === null) {
          tally.placeholderClass++;
          continue;
        }
        if (ca === null && exam === null) {
          tally.blank++;
          continue;
        }
        const student = number ? students.get(String(number)) : studentsWithoutAdmission.get(nameKey(studentName));
        if (!student) {
          if (!skippedStudents.has(number ?? nameKey(studentName))) {
            flag("score-skipped-unknown-student", number ?? studentName, where);
          }
          continue;
        }
        const bad = [ca, exam].some((v) => v !== null && (typeof v !== "number" || v < 0));
        if (bad) {
          flag("score-skipped-invalid", student.admissionNumber, `${where} — CA "${ca}", exam "${exam}"`);
          continue;
        }
        const key = [student.admissionNumber, subject, session, term].join("|");
        if (scores.has(key)) {
          flag("score-skipped-duplicate", student.admissionNumber, `${where} — CA ${ca}, exam ${exam} (first entry kept)`);
          continue;
        }
        if ((ca ?? 0) > caMax || (exam ?? 0) > examMax) {
          flag("score-over-maximum", student.admissionNumber, `${where} — CA ${ca}/${caMax}, exam ${exam}/${examMax}`);
        }
        if (total !== null && Math.abs((ca ?? 0) + (exam ?? 0) - total) > 0.005) {
          flag("score-total-differs", student.admissionNumber, `${where} — CA ${ca} + exam ${exam}, but export total ${total}`);
        }
        scores.set(key, { student, subject, session, term, cls, ca, exam, caMax, examMax });
      }
    }
  }

  // The export has no entry year. Use the first session the student has
  // results in; students with no results fall back to the current session.
  for (const s of scores.values()) {
    const year = s.session.slice(0, 4);
    if (!s.student.entryYear || year < s.student.entryYear) s.student.entryYear = year;
  }
  for (const s of students.values()) s.entryYear ??= currentSession.slice(0, 4);

  return {
    sessions,
    terms,
    currentSession,
    currentTerm,
    classes: [...classes.values()],
    subjects: [...subjects].sort(),
    classSubjects: [...classSubjects].map((k) => k.split("::")),
    students: [...students.values()],
    parents: [...parents.values()],
    staff: [...staff.values()],
    scores: [...scores.values()],
    tally,
    review,
  };
}

// ------------------------------------------------------------------
// Output files
// ------------------------------------------------------------------

const OUT_DIR = new URL("../import-output/", import.meta.url);
const csvLine = (cells) =>
  cells.map((c) => (/[",\n]/.test(String(c ?? "")) ? `"${String(c).replace(/"/g, '""')}"` : String(c ?? ""))).join(",") + "\n";

function writeReview(review) {
  mkdirSync(OUT_DIR, { recursive: true });
  const path = new URL("review.csv", OUT_DIR);
  writeFileSync(path, csvLine(["kind", "reference", "detail"]) + review.map((r) => csvLine([r.kind, r.ref, r.detail])).join(""));
  return path.pathname;
}

function printPlan(plan) {
  const count = (arr, fn) => arr.filter(fn).length;
  console.log(`
In the export
  Sessions         ${plan.sessions.length}  (${plan.sessions.join(", ")})
  Terms            ${plan.terms.length}  (current: ${plan.currentSession} ${plan.currentTerm})
  Campuses         ${new Set(plan.classes.map((c) => c.campus)).size}
  Classes          ${plan.classes.length}
  Subjects         ${plan.subjects.length}
  Class subjects   ${plan.classSubjects.length}
  Students         ${plan.students.length}  (${count(plan.students, (s) => s.active)} active)
  Parents          ${plan.parents.length}  (${plan.parents.reduce((n, p) => n + p.children.length, 0)} links to students)
  Staff logins     ${plan.staff.length}  (${count(plan.staff, (s) => s.role === "admin")} admin, ${count(plan.staff, (s) => s.role === "teacher")} teacher)
  Term scores      ${plan.scores.length}
    left out: ${plan.tally.blank} rows with no marks, ${plan.tally.placeholderClass} rows from placeholder classes
`);
  const kinds = new Map();
  for (const r of plan.review) kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1);
  console.log("Rows to review");
  for (const [kind, n] of [...kinds].sort()) console.log(`  ${String(n).padStart(5)}  ${kind}`);
}

// ------------------------------------------------------------------
// Apply — insert-only writes to Supabase
// ------------------------------------------------------------------

function loadEnv() {
  // tiny .env.local loader (avoids adding dotenv)
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* rely on real env */
  }
}

async function apply(plan) {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing env. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const supa = createClient(url, key, { auth: { persistSession: false } });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  mkdirSync(OUT_DIR, { recursive: true });

  const ok = ({ data, error }, what) => {
    if (error) throw new Error(`${what}: ${error.message}`);
    return data;
  };
  /** Every row of a table — Supabase caps a single select at 1000 rows. */
  const fetchAll = async (table, columns) => {
    const all = [];
    for (let from = 0; ; from += 1000) {
      const page = ok(await supa.from(table).select(columns).order("id").range(from, from + 999), `read ${table}`);
      all.push(...page);
      if (page.length < 1000) return all;
    }
  };
  /** Insert rows in batches, skipping any that collide with `onConflict`. */
  const insertNew = async (table, rows, onConflict, size = 500) => {
    for (let i = 0; i < rows.length; i += size) {
      ok(
        await supa.from(table).upsert(rows.slice(i, i + size), { onConflict, ignoreDuplicates: true }),
        `write ${table}`
      );
    }
  };
  const done = (label, added, total) =>
    console.log(`  ${label.padEnd(16)} ${String(added).padStart(6)} added, ${total - added} already there`);

  // --- sessions & terms
  let before = (await fetchAll("academic_sessions", "id")).length;
  await insertNew("academic_sessions", plan.sessions.map((name) => ({ name })), "name");
  const sessionRows = await fetchAll("academic_sessions", "id, name, is_current");
  const sessionId = new Map(sessionRows.map((r) => [r.name, r.id]));
  done("Sessions", sessionRows.length - before, plan.sessions.length);

  before = (await fetchAll("terms", "id")).length;
  await insertNew(
    "terms",
    plan.terms.map((t) => ({ session_id: sessionId.get(t.session), name: t.name })),
    "session_id,name"
  );
  const termRows = await fetchAll("terms", "id, session_id, name, is_current");
  const termId = new Map(termRows.map((r) => [`${r.session_id}|${r.name}`, r.id]));
  const termIdFor = (session, term) => termId.get(`${sessionId.get(session)}|${term}`);
  done("Terms", termRows.length - before, plan.terms.length);

  // Only mark a current session/term if the portal doesn't have one yet.
  if (!sessionRows.some((r) => r.is_current)) {
    ok(await supa.from("academic_sessions").update({ is_current: true }).eq("id", sessionId.get(plan.currentSession)), "set current session");
  }
  if (!termRows.some((r) => r.is_current) && plan.currentTerm) {
    ok(await supa.from("terms").update({ is_current: true }).eq("id", termIdFor(plan.currentSession, plan.currentTerm)), "set current term");
  }

  // --- campuses & classes
  const campusNames = [...new Set(plan.classes.map((c) => c.campus))];
  await insertNew("campuses", campusNames.map((name) => ({ name })), "name");
  const campusId = new Map((await fetchAll("campuses", "id, name")).map((r) => [r.name, r.id]));
  const campusName = new Map([...campusId].map(([name, id]) => [id, name]));

  const readClasses = async () =>
    new Map(
      (await fetchAll("classes", "id, campus_id, level, arm")).map((r) => [
        classKey({ campus: campusName.get(r.campus_id), level: r.level, arm: r.arm }),
        r.id,
      ])
    );
  let classId = await readClasses();
  const newClasses = plan.classes.filter((c) => !classId.has(classKey(c)));
  if (newClasses.length) {
    ok(
      await supa.from("classes").insert(newClasses.map((c) => ({ campus_id: campusId.get(c.campus), level: c.level, arm: c.arm }))),
      "write classes"
    );
    classId = await readClasses();
  }
  done("Classes", newClasses.length, plan.classes.length);

  // --- subjects & class subjects
  before = (await fetchAll("subjects", "id")).length;
  await insertNew("subjects", plan.subjects.map((name) => ({ name })), "name");
  const subjectRows = await fetchAll("subjects", "id, name");
  const subjectId = new Map(subjectRows.map((r) => [r.name, r.id]));
  done("Subjects", subjectRows.length - before, plan.subjects.length);

  before = (await fetchAll("class_subjects", "id")).length;
  await insertNew(
    "class_subjects",
    plan.classSubjects.map(([cls, subject]) => ({ class_id: classId.get(cls), subject_id: subjectId.get(subject) })),
    "class_id,subject_id"
  );
  done("Class subjects", (await fetchAll("class_subjects", "id")).length - before, plan.classSubjects.length);

  // --- students (PINs are written to disk batch by batch, straight after
  // the insert that makes them real, so a crash never strands a PIN)
  const readStudents = async () => new Map((await fetchAll("students", "id, admission_number")).map((r) => [r.admission_number, r.id]));
  let studentId = await readStudents();
  const newStudents = plan.students.filter((s) => !studentId.has(s.admissionNumber));
  if (newStudents.length) {
    const pinFile = new URL(`student-pins-${stamp}.csv`, OUT_DIR);
    writeFileSync(pinFile, csvLine(["admission_number", "full_name", "class", "pin"]));
    for (let i = 0; i < newStudents.length; i += 100) {
      const batch = newStudents.slice(i, i + 100).map((s) => ({ s, pin: String(randomInt(0, 1_000_000)).padStart(6, "0") }));
      const rows = [];
      for (const { s, pin } of batch) {
        rows.push({
          admission_number: s.admissionNumber,
          full_name: s.fullName,
          class_name: s.cls.level,
          class_id: classId.get(classKey(s.cls)),
          entry_year: s.entryYear,
          pin_hash: await bcrypt.hash(pin, 10),
          active: s.active,
          gender: s.gender,
          date_of_birth: s.dateOfBirth,
          address: s.address,
          phone: s.phone,
        });
      }
      ok(await supa.from("students").insert(rows), "write students");
      for (const { s, pin } of batch) {
        appendFileSync(pinFile, csvLine([s.admissionNumber, s.fullName, `${s.cls.level}${s.cls.arm ? " " + s.cls.arm : ""} (${s.cls.campus})`, pin]));
      }
      process.stdout.write(`\r  Students         ${Math.min(i + 100, newStudents.length)}/${newStudents.length}`);
    }
    process.stdout.write("\r");
    studentId = await readStudents();
    console.log(`  → PINs for the new students: ${pinFile.pathname}`);
  }
  done("Students", newStudents.length, plan.students.length);

  // --- parents
  before = (await fetchAll("parents", "id")).length;
  await insertNew(
    "parents",
    plan.parents.map((p) => ({ title: p.title, full_name: p.fullName, email: p.email, phone: p.phone, address: p.address, active: p.active })),
    "email"
  );
  const parentRows = await fetchAll("parents", "id, email");
  const parentId = new Map(parentRows.map((r) => [r.email, r.id]));
  done("Parents", parentRows.length - before, plan.parents.length);
  await insertNew(
    "student_parents",
    plan.parents.flatMap((p) => p.children.map((c) => ({ student_id: studentId.get(c), parent_id: parentId.get(p.email) }))),
    "student_id,parent_id"
  );

  // --- staff logins
  const existingStaff = new Set((await fetchAll("staff", "id, email")).map((r) => r.email.toLowerCase()));
  const newStaff = plan.staff.filter((s) => !existingStaff.has(s.email));
  let createdStaff = 0;
  if (newStaff.length) {
    const credFile = new URL(`staff-passwords-${stamp}.csv`, OUT_DIR);
    writeFileSync(credFile, csvLine(["full_name", "email", "role", "password"]));
    for (const s of newStaff) {
      const password = randomBytes(9).toString("base64url");
      const { data: created, error: authErr } = await supa.auth.admin.createUser({
        email: s.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: s.fullName },
      });
      if (authErr) {
        console.error(`  ! ${s.email}: could not create login — ${authErr.message}`);
        continue;
      }
      const { error: profErr } = await supa.from("staff").insert({ id: created.user.id, full_name: s.fullName, email: s.email, role: s.role });
      if (profErr) {
        await supa.auth.admin.deleteUser(created.user.id).catch(() => {});
        console.error(`  ! ${s.email}: could not create staff profile — ${profErr.message}`);
        continue;
      }
      appendFileSync(credFile, csvLine([s.fullName, s.email, s.role, password]));
      createdStaff++;
    }
    console.log(`  → Passwords for the new staff: ${credFile.pathname}`);
  }
  done("Staff logins", createdStaff, plan.staff.length - (newStaff.length - createdStaff));

  // --- term scores
  const { count: scoresBefore } = await supa.from("term_scores").select("id", { count: "exact", head: true });
  await insertNew(
    "term_scores",
    plan.scores.map((s) => ({
      student_id: studentId.get(s.student.admissionNumber),
      subject_id: subjectId.get(s.subject),
      term_id: termIdFor(s.session, s.term),
      class_id: classId.get(classKey(s.cls)),
      ca_score: s.ca,
      exam_score: s.exam,
      ca_max: s.caMax,
      exam_max: s.examMax,
    })),
    "student_id,subject_id,term_id",
    1000
  );
  const { count: scoresAfter } = await supa.from("term_scores").select("id", { count: "exact", head: true });
  done("Term scores", (scoresAfter ?? 0) - (scoresBefore ?? 0), plan.scores.length);
}

// ------------------------------------------------------------------

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const shouldApply = args.includes("--apply");
if (!dir) {
  console.error("Usage: node scripts/import-legacy-export.mjs <export-dir> [--apply]");
  process.exit(1);
}

const plan = await buildPlan(dir);
printPlan(plan);
console.log(`\nFull list: ${writeReview(plan.review)}`);

if (shouldApply) {
  console.log("\nWriting to the database");
  await apply(plan);
  console.log("\n✅ Import finished.");
} else {
  console.log("\nDry run — nothing was written. Re-run with --apply to load the data.");
}
