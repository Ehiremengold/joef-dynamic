"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, EDITABLE, sendJson, useApi, useInvalidate } from "@/lib/client/api";
import { isAdmin } from "@/lib/roles";
import { classLabel } from "@/lib/classes";
import { defaultTargetSession, nextLevel, sessionStartYear, suggestNextClass } from "@/lib/promotion";
import type { AcademicSession, Class, Promotion, PromotionCandidate, SignedInStaff, Term } from "@/lib/types";
import { useConfirm } from "./useConfirm";

type Choice = "promoted" | "repeated" | "graduated" | "skip";
type RowPlan = { choice: Choice; toClassId: string };

const OUTCOME_LABEL: Record<Promotion["outcome"], string> = {
  promoted: "Promoted",
  repeated: "Repeating",
  graduated: "Graduated",
};

const SELECT =
  "mt-1 cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy";

export default function PromotionPanel({
  me,
  onUnauthorized,
}: {
  me: SignedInStaff;
  onUnauthorized: () => void;
}) {
  const { confirm, dialog } = useConfirm();
  const invalidate = useInvalidate();
  const sessionsQ = useApi<{ sessions: AcademicSession[] }>("/api/sessions", onUnauthorized);
  const termsQ = useApi<{ terms: Term[] }>("/api/terms", onUnauthorized);
  const classesQ = useApi<{ classes: Class[] }>("/api/classes", onUnauthorized);
  const [chosenSession, setSessionId] = useState("");
  const [chosenClass, setClassId] = useState("");
  const [chosenTarget, setTargetId] = useState<{ forClass: string; id: string } | null>(null);
  const [plan, setPlan] = useState<{ url: string | null; rows: Record<string, Partial<RowPlan>> }>({ url: null, rows: {} });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sessions = useMemo(() => sessionsQ.data?.sessions ?? [], [sessionsQ.data]);
  const allClasses = useMemo(() => classesQ.data?.classes ?? [], [classesQ.data]);
  const myClasses = useMemo(
    () => (isAdmin(me.role) ? allClasses : allClasses.filter((c) => c.classTeacherId === me.id)),
    [allClasses, me.id, me.role]
  );
  const currentTerm = termsQ.data?.terms.find((t) => t.isCurrent) ?? null;
  const currentSession = sessions.find((s) => s.isCurrent) ?? null;
  const sessionId = chosenSession || defaultTargetSession(sessions, currentTerm)?.id || "";
  // How many students each class still has to move into the session (SS3: to graduate).
  const progressQ = useApi<{ waiting: Record<string, number> }>(
    sessionId ? `/api/promotions?sessionId=${sessionId}` : null,
    onUnauthorized
  );
  const waiting = progressQ.data?.waiting ?? {};
  const toDo = myClasses.filter((c) => waiting[c.id]);
  // Opens on the first class with students still to move.
  const classId = chosenClass || toDo[0]?.id || myClasses[0]?.id || "";
  const cls = allClasses.find((c) => c.id === classId) ?? null;
  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const graduating = cls?.level === "SS3";
  // Each class picks its own likely destination until someone changes it.
  const targetId =
    chosenTarget && chosenTarget.forClass === classId
      ? chosenTarget.id
      : cls
        ? suggestNextClass(cls, allClasses)?.id ?? ""
        : "";

  const promotionUrl = classId && sessionId ? `/api/classes/${classId}/promotion?sessionId=${sessionId}` : null;
  const promotionQ = useApi<{ students: PromotionCandidate[]; done: Promotion[] }>(promotionUrl, onUnauthorized, EDITABLE);
  const students = useMemo(() => promotionQ.data?.students ?? [], [promotionQ.data]);
  const done = promotionQ.data?.done ?? [];

  useEffect(() => {
    setNotice("");
  }, [promotionUrl]);

  // Everyone starts on the default for the class; students who joined in the
  // new session are already where they belong, so they start on "Not now".
  // Only changes from the default are kept, and only for the list on screen.
  const joinedYear = session ? sessionStartYear(session.name) : "";
  const defaultRow = (st: PromotionCandidate): RowPlan => ({
    choice: joinedYear && st.entryYear >= joinedYear ? "skip" : graduating ? "graduated" : "promoted",
    toClassId: "",
  });
  const changes = plan.url === promotionUrl ? plan.rows : {};
  const rowFor = (st: PromotionCandidate): RowPlan => ({ ...defaultRow(st), ...changes[st.id] });

  /**
   * A move changes who is in which class: the roster, every class's
   * attendance, report-card and promotion lists, and what's left to do.
   */
  const refreshAfterMove = () => invalidate("/api/students", "/api/classes/*", "/api/promotions");

  const update = (id: string, patch: Partial<RowPlan>) =>
    setPlan({ url: promotionUrl, rows: { ...changes, [id]: { ...changes[id], ...patch } } });

  const destination = (row: RowPlan) => row.toClassId || targetId;
  const moves = students
    .map((s) => ({ s, row: rowFor(s) }))
    .filter(({ row }) => row && row.choice !== "skip");
  const missingClass = moves.some(({ row }) => row.choice === "promoted" && !destination(row));
  const counts = {
    promoted: moves.filter(({ row }) => row.choice === "promoted").length,
    repeated: moves.filter(({ row }) => row.choice === "repeated").length,
    graduated: moves.filter(({ row }) => row.choice === "graduated").length,
  };
  // Says exactly what pressing it will do: "Promote 4 students, keep 1 back".
  const nStudents = (n: number) => `${n} student${n === 1 ? "" : "s"}`;
  const actions = [
    counts.promoted && `promote ${nStudents(counts.promoted)}`,
    counts.graduated && `graduate ${nStudents(counts.graduated)}`,
    counts.repeated && `keep ${counts.repeated} back`,
  ].filter(Boolean) as string[];
  const buttonLabel = actions.length
    ? actions.join(", ").replace(/^./, (c) => c.toUpperCase())
    : graduating
      ? "Graduate 0 students"
      : "Promote 0 students";

  async function submit() {
    if (!cls || !session) return;
    const target = allClasses.find((c) => c.id === targetId);
    const parts = [
      counts.promoted && `${counts.promoted} promoted${target && !moves.some(({ row }) => row.toClassId) ? ` to ${classLabel(target)}` : ""}`,
      counts.repeated && `${counts.repeated} repeating ${classLabel(cls)}`,
      counts.graduated && `${counts.graduated} graduating (marked as left)`,
    ].filter(Boolean);
    const ok = await confirm({
      title: `${buttonLabel} for ${session.name}?`,
      message: (
        <>
          <p>{parts.join(", ")}.</p>
          <p className="mt-2">You can undo any of these afterwards from the list below.</p>
        </>
      ),
      confirmLabel: "Confirm",
    });
    if (!ok) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const d = await sendJson<{ moved: number }>(`/api/classes/${cls.id}/promotion`, "POST", {
        sessionId,
        moves: moves.map(({ s, row }) => ({
          studentId: s.id,
          outcome: row.choice,
          toClassId: row.choice === "promoted" ? destination(row) : null,
        })),
      });
      setPlan({ url: null, rows: {} });
      await refreshAfterMove();
      setNotice(`${nStudents(d.moved)} moved into ${session.name}.`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setError(e instanceof Error ? e.message : "Could not promote the class");
    } finally {
      setSaving(false);
    }
  }

  async function undo(p: Promotion) {
    const ok = await confirm({
      title: `Undo for ${p.fullName}?`,
      message: `They go back into ${cls ? classLabel(cls) : "this class"}${p.outcome === "graduated" ? " and are marked active again" : ""}.`,
      confirmLabel: "Undo",
    });
    if (!ok) return;
    try {
      await sendJson(`/api/promotions/${p.id}`, "DELETE");
      await refreshAfterMove();
      setNotice(`${p.fullName} is back in ${cls ? classLabel(cls) : "this class"}.`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setError(e instanceof Error ? e.message : "Could not undo");
    }
  }

  if (sessionsQ.isPending || classesQ.isPending || termsQ.isPending) return <p className="text-sm text-graphite">Loading…</p>;

  const nextLvl = cls ? nextLevel(cls.level) : null;

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Promote or graduate students</h2>
          <p className="mt-1 max-w-[640px] text-sm leading-relaxed text-graphite">
            Move a class up for the new session, or graduate an SS3 class. Do this after the Third Term
            results, attendance and report cards are finished. Past results always keep the class they
            were taken in.
          </p>
        </div>
      </div>

      {myClasses.length === 0 ? (
        <p className="text-sm text-graphite">
          {isAdmin(me.role)
            ? "No classes yet, add one under the Classes tab."
            : "You are not the class teacher of any class yet. Ask an admin to assign you under Classes."}
        </p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-graphite">
          No sessions set up yet. An admin can add one under the Sessions &amp; terms tab.
        </p>
      ) : (
        <>
          {session && progressQ.data && (
            <div data-tour="promo-progress" className="rounded-card border border-smoke bg-white p-4">
              {toDo.length === 0 ? (
                <p className="text-sm font-semibold text-brand-green">
                  Every class is done: nobody is left to move into {session.name}.
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold">
                    Still to do for {session.name}: {toDo.length} class{toDo.length === 1 ? "" : "es"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {toDo.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setClassId(c.id)}
                        aria-pressed={c.id === classId}
                        className={`cursor-pointer rounded-btn border px-2.5 py-1 text-[13px] font-semibold transition-colors duration-150 ${
                          c.id === classId ? "border-brand-navy bg-brand-navy text-white" : "border-smoke text-ink hover:border-brand-navy"
                        }`}
                      >
                        {classLabel(c)}: {waiting[c.id]} to {c.level === "SS3" ? "graduate" : "move"}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <div data-tour="promo-session">
              <label className="block text-[13px] font-semibold" htmlFor="promo-session">Moving into session</label>
              <select id="promo-session" value={sessionId} onChange={(e) => setSessionId(e.target.value)} className={SELECT}>
                {[...sessions]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.isCurrent ? " (current)" : ""}
                    </option>
                  ))}
              </select>
            </div>
            <div data-tour="promo-class">
              <label className="block text-[13px] font-semibold" htmlFor="promo-class">Class</label>
              <select id="promo-class" value={classId} onChange={(e) => setClassId(e.target.value)} className={SELECT}>
                {myClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {classLabel(c)}
                    {progressQ.data ? (waiting[c.id] ? ` (${waiting[c.id]} to ${c.level === "SS3" ? "graduate" : "move"})` : " (done)") : ""}
                  </option>
                ))}
              </select>
            </div>
            {!graduating && (
              <div data-tour="promo-target">
                <label className="block text-[13px] font-semibold" htmlFor="promo-target">Promote to</label>
                <select id="promo-target" value={targetId} onChange={(e) => setTargetId({ forClass: classId, id: e.target.value })} className={SELECT}>
                  <option value="">Choose a class…</option>
                  {allClasses
                    .filter((c) => c.id !== classId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>{classLabel(c)}</option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {cls && !graduating && !targetId && (
            <p className="rounded-btn bg-brand-gold/20 px-4 py-3 text-sm text-ink">
              There is no {nextLvl} class on the {cls.campusName} campus yet. An admin can add it under
              Classes, or choose another class above.
            </p>
          )}
          {session && currentSession && session.name < currentSession.name && (
            <p className="rounded-btn bg-brand-gold/20 px-4 py-3 text-sm text-ink">
              {session.name} is before the current session ({currentSession.name}). Students are
              normally moved into the current session or the one after it.
            </p>
          )}
          {graduating && session && (
            <p className="rounded-btn bg-mist px-4 py-3 text-sm text-ink">
              These are the students who finished SS3 last session. Graduating marks them as having left the
              school: they come off this class&rsquo;s lists, and their results and report cards are kept.
              Students promoted into {cls ? classLabel(cls) : "SS3"} for {session.name} aren&rsquo;t listed, so they stay.
            </p>
          )}
          {(error || promotionQ.error) && (
            <p className="text-sm font-semibold text-brand-red" role="alert">{error || promotionQ.error?.message}</p>
          )}
          {notice && <p className="text-sm font-semibold text-brand-green">{notice}</p>}

          <div data-tour="promo-table" className="min-w-0 overflow-x-auto rounded-card border border-smoke bg-white">
            {promotionQ.isPending ? (
              <p className="p-6 text-sm text-graphite">Loading…</p>
            ) : students.length === 0 ? (
              <p className="p-6 text-sm text-graphite">
                {done.length
                  ? `Everyone in this class has been moved into ${session?.name}.`
                  : "No active students in this class."}
              </p>
            ) : (
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-smoke text-[13px] uppercase tracking-wide text-pewter">
                    <th className="px-4 py-3 font-semibold">Admission no.</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Decision</th>
                    <th className="px-4 py-3 font-semibold">Moves to</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const row = rowFor(s);
                    const joined = session && s.entryYear >= sessionStartYear(session.name);
                    return (
                      <tr key={s.id} className="border-b border-smoke last:border-0">
                        <td className="px-4 py-2.5 font-mono text-[13px]">{s.admissionNumber}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-semibold">{s.fullName}</span>
                          {joined && (
                            <span className="ml-2 rounded-btn bg-mist px-1.5 py-0.5 text-[12px] text-graphite">
                              joined {session?.name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            aria-label={`Decision for ${s.fullName}`}
                            value={row.choice}
                            onChange={(e) => update(s.id, { choice: e.target.value as Choice })}
                            className="cursor-pointer rounded-btn border border-smoke bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-navy"
                          >
                            {graduating ? (
                              <option value="graduated">Graduate</option>
                            ) : (
                              <option value="promoted">Promote</option>
                            )}
                            <option value="repeated">Repeat</option>
                            <option value="skip">Not now</option>
                          </select>
                        </td>
                        <td className="px-4 py-2.5 text-graphite">
                          {row.choice === "promoted" ? (
                            <select
                              aria-label={`Class for ${s.fullName}`}
                              value={row.toClassId}
                              onChange={(e) => update(s.id, { toClassId: e.target.value })}
                              className="cursor-pointer rounded-btn border border-smoke bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-navy"
                            >
                              <option value="">
                                {targetId ? `${classLabel(allClasses.find((c) => c.id === targetId)!)} (as above)` : "Choose a class…"}
                              </option>
                              {allClasses
                                .filter((c) => c.id !== classId && c.id !== targetId)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>{classLabel(c)}</option>
                                ))}
                            </select>
                          ) : row.choice === "repeated" ? (
                            `Stays in ${cls ? classLabel(cls) : "this class"}`
                          ) : row.choice === "graduated" ? (
                            "Leaves the school"
                          ) : (
                            "Decide later"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {students.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-tour="promo-submit"
                onClick={submit}
                disabled={saving || promotionQ.isFetching || moves.length === 0 || missingClass}
                className="cursor-pointer rounded-btn bg-brand-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving…" : buttonLabel}
              </button>
              {missingClass && (
                <span className="text-sm text-graphite">Choose where the promoted students go first.</span>
              )}
            </div>
          )}

          {done.length > 0 && (
            <div data-tour="promo-done" className="rounded-card border border-smoke bg-white">
              <h3 className="border-b border-smoke px-4 py-3 font-display text-base font-bold tracking-tight">
                Already moved into {session?.name} ({done.length})
              </h3>
              <ul>
                {done.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-smoke px-4 py-2.5 text-sm last:border-0">
                    <span>
                      <span className="font-mono text-[13px] text-pewter">{p.admissionNumber}</span>{" "}
                      <span className="font-semibold">{p.fullName}</span>{" "}
                      <span className="text-graphite">
                        · {OUTCOME_LABEL[p.outcome]}
                        {p.outcome === "promoted" && p.toClassLabel ? ` to ${p.toClassLabel}` : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => undo(p)}
                      className="cursor-pointer text-[13px] font-semibold text-brand-navy hover:underline"
                    >
                      Undo
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
