/**
 * Add new students from a class-list workbook (one sheet, a heading row per
 * class such as "JSS ONE A (OBALENDE)", then that class's students) — the
 * shape of the school's New_Users.xlsx intake sheet.
 *
 *   node scripts/import-class-lists.mjs <workbook.xlsx>           # dry run
 *   node scripts/import-class-lists.mjs <workbook.xlsx> --apply   # write
 *
 * A dry run reads the database but writes nothing; it prints who would be
 * added, who is skipped and why.
 *
 * Students already in the portal are skipped, not moved: a returning
 * student listed under their new class is promoted from the Promotion tab
 * like the rest of their class. A row counts as an existing student when the
 * same name words match an existing student, or when two name words match
 * and the birth dates agree (or one is missing).
 *
 * --apply is insert-only and safe to re-run. New students get the next
 * JDCL-xxxxx admission number and a PIN; PINs are written once to
 * import-output/ (gitignored) for hand-out.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { randomInt } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import ws from "ws";

if (typeof globalThis.WebSocket === "undefined") globalThis.WebSocket = ws;

// ------------------------------------------------------------------
// Decisions about the sheet — change these, not the code below.
// ------------------------------------------------------------------

// New students joined in this session; the Promotion tab leaves them where
// they are when it moves the rest of their class on.
const ENTRY_YEAR = "2026";

// Obalende runs arms; a heading with no arm (e.g. "JSS TWO (OBALENDE)") goes
// in this arm when the level has arms. Ikoyi runs one class per level, so a
// heading's arm is dropped there unless that exact arm exists.
const DEFAULT_OBALENDE_ARM = "A";

const NUMBER_WORDS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6 };
const LEVEL_PREFIX = { JSS: "JS", JS: "JS", SSS: "SS", SS: "SS", BASIC: "BS", NURSERY: "NUR", KG: "KG" };
const LEVELS = ["KG1", "KG2", "NUR1", "NUR2", "BS1", "BS2", "BS3", "BS4", "BS5", "JS1", "JS2", "JS3", "SS1", "SS2", "SS3"];

// ------------------------------------------------------------------

const text = (v) => (v === null || v === undefined ? null : String(v).replace(/\s+/g, " ").trim() || null);

function cellValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return cellValue(v.richText.map((t) => t.text).join(""));
    if ("result" in v) return cellValue(v.result);
    if ("text" in v) return cellValue(v.text);
    return null;
  }
  return text(v);
}

/** "JSS ONE A (OBALENDE)", "SS2 (Ikoyi)", "NURSERY TWO" → { level, arm, campus } */
function parseClass(raw) {
  const m = String(raw ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
    .match(/^(JSS|JS|SSS|SS|BASIC|NURSERY|KG) ?(\d|ONE|TWO|THREE|FOUR|FIVE|SIX)(?: ([A-Z]))?(?: ?\((IKOYI|OBALENDE)\))?$/);
  if (!m) return null;
  const level = `${LEVEL_PREFIX[m[1]]}${NUMBER_WORDS[m[2]] ?? m[2]}`;
  if (!LEVELS.includes(level)) return null;
  const campus = m[4] ? m[4][0] + m[4].slice(1).toLowerCase() : null;
  return { level, arm: m[3] ?? null, campus };
}

/** ISO dates and dd/mm/yyyy; anything implausible is dropped. */
function birthDate(raw) {
  const s = text(raw);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let iso = m ? s : null;
  if (!iso && (m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  const year = Number(iso.slice(0, 4));
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso || year < 1990 || year > new Date().getFullYear()) return null;
  return iso;
}

/** Excel drops the leading 0 of Nigerian mobile numbers stored as numbers. */
const phoneNumber = (raw) =>
  text(raw)
    ?.split(/\s*,\s*/)
    .map((p) => (/^[789]\d{9}$/.test(p) ? `0${p}` : p))
    .join(", ") ?? null;

const firstEmail = (raw) => text(raw)?.toLowerCase().match(/[^@\s/,;]+@[^@\s/,;]+\.[a-z]{2,}/)?.[0] ?? null;
const nameWords = (s) => String(s).toLowerCase().replace(/[^a-z]+/g, " ").trim().split(" ").filter(Boolean);
const nameKey = (s) => nameWords(s).sort().join(" ");

function readSheet(path) {
  const wb = new ExcelJS.Workbook();
  return wb.xlsx.readFile(path).then(() => {
    const sheet = wb.worksheets[0];
    const header = [];
    sheet.getRow(1).eachCell((c, i) => (header[i] = cellValue(c.value)));
    const col = (name) => {
      const i = header.indexOf(name);
      if (i === -1) throw new Error(`Column "${name}" not found`);
      return i;
    };
    const C = Object.fromEntries(
      ["First Name", "Middle Name", "Last Name", "Gender", "Date of Birth", "Address", "Email", "Phone Number", "Current Class", "Parents"].map(
        (n) => [n, col(n)]
      )
    );
    const rows = [];
    let heading = null;
    sheet.eachRow((row, n) => {
      if (n === 1) return;
      const get = (name) => cellValue(row.getCell(C[name]).value);
      // A heading row is one merged cell across the row.
      const first = cellValue(row.getCell(1).value);
      if (first && first === cellValue(row.getCell(2).value)) {
        heading = first;
        return;
      }
      rows.push({
        row: n,
        heading,
        fullName: [get("First Name"), get("Middle Name"), get("Last Name")].filter(Boolean).join(" "),
        gender: get("Gender")?.toLowerCase() ?? null,
        rawBirthDate: get("Date of Birth"),
        dateOfBirth: birthDate(get("Date of Birth")),
        address: get("Address"),
        email: firstEmail(get("Email")),
        phone: phoneNumber(get("Phone Number")),
        currentClass: get("Current Class"),
        parent: get("Parents"),
      });
    });
    return rows;
  });
}

function connect() {
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* rely on real env */
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing env. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function main() {
  const [path, ...flags] = process.argv.slice(2);
  if (!path) {
    console.error("Usage: node scripts/import-class-lists.mjs <workbook.xlsx> [--apply]");
    process.exit(1);
  }
  const shouldApply = flags.includes("--apply");
  const supa = connect();
  const ok = ({ data, error }, what) => {
    if (error) throw new Error(`${what}: ${error.message}`);
    return data;
  };
  const fetchAll = async (table, columns) => {
    const all = [];
    for (let from = 0; ; from += 1000) {
      const page = ok(await supa.from(table).select(columns).order("id").range(from, from + 999), `read ${table}`);
      all.push(...page);
      if (page.length < 1000) return all;
    }
  };

  const rows = await readSheet(path);
  const campuses = await fetchAll("campuses", "id, name");
  const campusId = new Map(campuses.map((c) => [c.name, c.id]));
  let classes = await fetchAll("classes", "id, campus_id, level, arm");
  const existing = await fetchAll("students", "id, admission_number, full_name, date_of_birth, class_name");

  const byKey = new Map();
  for (const s of existing) byKey.set(nameKey(s.full_name), [...(byKey.get(nameKey(s.full_name)) ?? []), s]);
  const findExisting = (r) => {
    const exact = byKey.get(nameKey(r.fullName));
    if (exact) return exact[0];
    const words = new Set(nameWords(r.fullName));
    return existing.find((s) => {
      const shared = nameWords(s.full_name).filter((w) => words.has(w)).length;
      return shared >= 2 && (!s.date_of_birth || !r.dateOfBirth || s.date_of_birth === r.dateOfBirth);
    });
  };

  /** The portal class a sheet class goes in: { campus, level, arm } with arm resolved. */
  const resolveClass = (c) => {
    const onCampus = classes.filter((k) => k.campus_id === campusId.get(c.campus) && k.level === c.level);
    const exactArm = onCampus.find((k) => (k.arm ?? null) === c.arm);
    if (exactArm) return { ...c, arm: exactArm.arm, id: exactArm.id };
    if (c.arm === null && c.campus === "Obalende") {
      const def = onCampus.find((k) => k.arm === DEFAULT_OBALENDE_ARM);
      if (def) return { ...c, arm: def.arm, id: def.id };
    }
    const noArm = onCampus.find((k) => k.arm === null);
    if (noArm) return { ...c, arm: null, id: noArm.id };
    return { ...c, arm: c.campus === "Obalende" ? c.arm ?? DEFAULT_OBALENDE_ARM : null, id: null };
  };

  const add = [];
  const skipped = [];
  const notes = [];
  for (const r of rows) {
    if (!r.fullName) {
      skipped.push([r.row, "(no name)", "row has no name"]);
      continue;
    }
    const fromHeading = parseClass(r.heading);
    if (!fromHeading?.campus) throw new Error(`Row ${r.row}: can't read the class heading "${r.heading}"`);
    // The row's own Current Class wins when it names a different level.
    const fromCell = parseClass(r.currentClass);
    let cls = fromHeading;
    if (fromCell && fromCell.level !== fromHeading.level) {
      cls = { ...fromHeading, level: fromCell.level, arm: fromCell.arm };
      notes.push(`row ${r.row} ${r.fullName}: heading says ${fromHeading.level}, Current Class says ${fromCell.level}, so using ${fromCell.level}`);
    }
    const match = findExisting(r);
    if (match) {
      skipped.push([r.row, r.fullName, `already in the portal as ${match.full_name} (${match.admission_number}, ${match.class_name}). Promote from the Promotion tab`]);
      continue;
    }
    if (r.rawBirthDate && !r.dateOfBirth) notes.push(`row ${r.row} ${r.fullName}: birth date "${r.rawBirthDate}" not understood, left blank`);
    add.push({ ...r, cls: resolveClass(cls) });
  }

  const label = (c) => `${c.campus} ${c.level}${c.arm ? " " + c.arm : ""}`;
  const missingClasses = [...new Map(add.filter((a) => !a.cls.id).map((a) => [label(a.cls), a.cls])).values()];

  console.log(`\n${rows.length} rows read`);
  console.log(`\nTo add: ${add.length} new students`);
  const perClass = new Map();
  for (const a of add) perClass.set(label(a.cls), (perClass.get(label(a.cls)) ?? 0) + 1);
  for (const [k, n] of perClass) console.log(`  ${String(n).padStart(3)}  ${k}${missingClasses.some((c) => label(c) === k) ? "  (class will be created)" : ""}`);
  console.log(`\nSkipped: ${skipped.length}`);
  for (const [row, name, why] of skipped) console.log(`  row ${row}  ${name}: ${why}`);
  if (notes.length) {
    console.log(`\nNotes`);
    for (const n of notes) console.log(`  ${n}`);
  }

  if (!shouldApply) {
    console.log("\nDry run: nothing was written. Re-run with --apply to add these students.");
    return;
  }

  console.log("\nWriting to the database");
  for (const c of missingClasses) {
    ok(await supa.from("classes").insert({ campus_id: campusId.get(c.campus), level: c.level, arm: c.arm }), "write classes");
    console.log(`  class created: ${label(c)}`);
  }
  if (missingClasses.length) {
    classes = await fetchAll("classes", "id, campus_id, level, arm");
    for (const a of add) if (!a.cls.id) a.cls = resolveClass(a.cls);
  }

  // Parents by email, so siblings share one record.
  const parents = await fetchAll("parents", "id, email");
  const parentId = new Map(parents.filter((p) => p.email).map((p) => [p.email.toLowerCase(), p.id]));

  let next = Math.max(0, ...existing.map((s) => Number(s.admission_number.match(/^JDCL-(\d{5})$/)?.[1] ?? 0))) + 1;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = new URL("../import-output/", import.meta.url);
  mkdirSync(outDir, { recursive: true });
  const pinFile = new URL(`student-pins-${stamp}.csv`, outDir);
  const csv = (cells) => cells.map((c) => (/[",\n]/.test(String(c ?? "")) ? `"${String(c).replace(/"/g, '""')}"` : String(c ?? ""))).join(",") + "\n";
  writeFileSync(pinFile, csv(["admission_number", "full_name", "class", "pin"]));

  let parentsAdded = 0;
  for (const a of add) {
    const admissionNumber = `JDCL-${String(next++).padStart(5, "0")}`;
    const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const [student] = ok(
      await supa
        .from("students")
        .insert({
          admission_number: admissionNumber,
          full_name: a.fullName,
          class_name: a.cls.level,
          class_id: a.cls.id,
          entry_year: ENTRY_YEAR,
          pin_hash: await bcrypt.hash(pin, 10),
          active: true,
          gender: a.gender === "male" || a.gender === "female" ? a.gender : null,
          date_of_birth: a.dateOfBirth,
          address: a.address,
          phone: a.phone,
        })
        .select("id"),
      `write student ${a.fullName}`
    );
    // Written straight after the insert that makes it real, so a crash never strands a PIN.
    appendFileSync(pinFile, csv([admissionNumber, a.fullName, label(a.cls), pin]));

    if (a.parent || a.email) {
      let pid = a.email ? parentId.get(a.email) : undefined;
      if (!pid) {
        const [p] = ok(
          await supa
            .from("parents")
            .insert({ full_name: a.parent ?? `Parent of ${a.fullName}`, email: a.email, phone: a.phone, address: a.address })
            .select("id"),
          `write parent of ${a.fullName}`
        );
        pid = p.id;
        if (a.email) parentId.set(a.email, pid);
        parentsAdded++;
      }
      ok(await supa.from("student_parents").insert({ student_id: student.id, parent_id: pid }), "link parent");
    }
  }
  console.log(`  Students  ${add.length} added`);
  console.log(`  Parents   ${parentsAdded} added`);
  console.log(`  → PINs for the new students: ${pinFile.pathname}`);
  console.log("\n✅ Done.");
}

await main();
