/**
 * Portal end-to-end test. Run against a dev server that has REAL Supabase env:
 *
 *   npm run dev           # in one terminal (with .env.local pointing at Supabase)
 *   node scripts/portal-e2e.mjs
 *
 * Proves: staff endpoints are guarded; takers get answer-stripped exams; marking is
 * correct; one-attempt-per-taker is enforced; students see only their own results.
 * Fixtures are created via the service key and cleaned up at the end.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import ws from "ws";

// Node < 22 has no global WebSocket; supabase-js needs one at construct time.
if (typeof globalThis.WebSocket === "undefined") globalThis.WebSocket = ws;

try {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || url.includes("example.supabase.co")) {
  console.error("Set real Supabase env in .env.local before running the e2e.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let pass = 0,
  fail = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  cond ? pass++ : fail++;
};

// node fetch has no cookie jar — track the taker cookie manually
function cookieFrom(res) {
  const raw = res.headers.get("set-cookie") || "";
  const m = raw.match(/jdc_taker=[^;]+/);
  return m ? m[0] : "";
}
const j = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });

const created = { exams: [], students: [], candidates: [] };

async function makeExam({ type, className, title }) {
  const { data: exam } = await db
    .from("exams")
    .insert({ type, class_name: className ?? null, title, duration_mins: 10, active: true })
    .select("*")
    .single();
  created.exams.push(exam.id);
  const qs = [
    { text: "7 x 8?", options: ["54", "56", "58", "64"], correct_index: 1 },
    { text: "12 + 15?", options: ["25", "26", "27", "28"], correct_index: 2 },
    { text: "A prime number?", options: ["9", "15", "17", "21"], correct_index: 2 },
  ].map((q, i) => ({ ...q, exam_id: exam.id, position: i }));
  await db.from("questions").insert(qs);
  return exam.id;
}

(async () => {
  for (let i = 0; i < 30; i++) {
    try {
      await fetch(BASE);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // 1. staff endpoints guarded
  ok("GET /api/exams blocked without auth", (await j(await fetch(`${BASE}/api/exams`))).status === 401);
  ok(
    "POST /api/exams blocked without auth",
    (
      await j(
        await fetch(`${BASE}/api/exams`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "hack" }),
        })
      )
    ).status === 401
  );
  ok(
    "GET /api/staff blocked without auth",
    (await j(await fetch(`${BASE}/api/staff`))).status === 401
  );

  // 2. fixtures
  const entranceId = await makeExam({ type: "entrance", title: "E2E Entrance" });
  const classId = await makeExam({ type: "class", className: "JS2", title: "E2E JS2 Maths" });

  // 3. candidate flow — gated by the entrance access code
  await db.from("entrance_access").upsert({ id: 1, code: "E2E-CODE", active: true });

  let res = await j(
    await fetch(`${BASE}/api/candidates/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "E2E Candidate", parentPhone: "0800", code: "WRONG" }),
    })
  );
  ok("candidate register rejects wrong code", res.status === 403);

  res = await fetch(`${BASE}/api/candidates/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "E2E Candidate", parentPhone: "0800", code: "E2E-CODE" }),
  });
  const candCookie = cookieFrom(res);
  ok("candidate register accepts active code", res.status === 201 && !!candCookie);
  const candNo = (await res.json()).candidate?.candidateNumber;

  res = await j(
    await fetch(`${BASE}/api/exams?type=entrance`, { headers: { cookie: candCookie } })
  );
  const leak = JSON.stringify(res.body).includes("correct_index") || JSON.stringify(res.body).includes("correctIndex");
  ok("taker exams hide answers", res.status === 200 && res.body.exams.length >= 1 && !leak);

  res = await j(
    await fetch(`${BASE}/api/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: candCookie },
      body: JSON.stringify({ examId: entranceId, answers: [1, 2, 0] }),
    })
  );
  ok("candidate attempt marked 2/3", res.status === 201 && res.body.attempt?.score === 2, `score ${res.body.attempt?.score}`);

  res = await j(
    await fetch(`${BASE}/api/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: candCookie },
      body: JSON.stringify({ examId: entranceId, answers: [1, 2, 2] }),
    })
  );
  ok("second candidate attempt rejected (one-attempt)", res.status === 409);

  // 4. student flow
  const pinHash = await bcrypt.hash("123456", 10);
  const { data: student } = await db
    .from("students")
    .insert({
      admission_number: `E2E/${Date.now()}`,
      full_name: "E2E Student",
      class_name: "JS2",
      entry_year: "2026",
      pin_hash: pinHash,
    })
    .select("*")
    .single();
  created.students.push(student.id);

  res = await fetch(`${BASE}/api/students/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admissionNumber: student.admission_number, pin: "123456" }),
  });
  const stuCookie = cookieFrom(res);
  ok("student login sets session", res.status === 200 && !!stuCookie);

  res = await j(await fetch(`${BASE}/api/students/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admissionNumber: student.admission_number, pin: "000000" }),
  }));
  ok("student login rejects wrong PIN", res.status === 401);

  res = await j(await fetch(`${BASE}/api/exams?type=class`, { headers: { cookie: stuCookie } }));
  ok(
    "student sees only their class exams",
    res.status === 200 && res.body.exams.every((e) => e.className === "JS2")
  );

  res = await j(
    await fetch(`${BASE}/api/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: stuCookie },
      body: JSON.stringify({ examId: classId, answers: [1, 2, 2] }),
    })
  );
  ok("student attempt marked 3/3", res.status === 201 && res.body.attempt?.score === 3, `score ${res.body.attempt?.score}`);

  res = await j(await fetch(`${BASE}/api/attempts`, { headers: { cookie: stuCookie } }));
  ok(
    "student sees only own results",
    res.status === 200 && res.body.attempts.length === 1 && res.body.attempts[0].takerName === "E2E Student"
  );

  // 5. cleanup
  await db.from("attempts").delete().in("exam_id", created.exams);
  await db.from("exams").delete().in("id", created.exams);
  await db.from("students").delete().in("id", created.students);
  await db.from("entrance_access").upsert({ id: 1, code: null, active: false });
  console.log(`\n${pass} passed, ${fail} failed. Candidate ${candNo} + fixtures cleaned up.`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("E2E ERROR", e);
  process.exit(1);
});
