import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { AcademicSession, Term } from "@/lib/types";

type Row = Record<string, unknown>;

function mapSession(r: Row): AcademicSession {
  return {
    id: r.id as string,
    name: r.name as string,
    isCurrent: r.is_current as boolean,
    createdAt: r.created_at as string,
  };
}

function mapTerm(r: Row): Term {
  const session = r.academic_sessions as Row | null;
  return {
    id: r.id as string,
    sessionId: r.session_id as string,
    sessionName: session?.name as string | undefined,
    name: r.name as Term["name"],
    isCurrent: r.is_current as boolean,
    createdAt: r.created_at as string,
  };
}

export async function listSessions(): Promise<AcademicSession[]> {
  const { data } = await serviceClient()
    .from("academic_sessions")
    .select("*")
    .order("name", { ascending: false });
  return (data ?? []).map(mapSession);
}

export async function createSession(name: string): Promise<AcademicSession> {
  const { data, error } = await serviceClient()
    .from("academic_sessions")
    .insert({ name })
    .select("*")
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error("That academic session already exists");
    }
    throw new Error(error.message);
  }
  return mapSession(data);
}

/** Make `id` the current session, unsetting any prior current session first. */
export async function setCurrentSession(id: string): Promise<void> {
  const supa = serviceClient();
  const { error: unsetErr } = await supa
    .from("academic_sessions")
    .update({ is_current: false })
    .eq("is_current", true);
  if (unsetErr) throw new Error(unsetErr.message);
  const { error } = await supa.from("academic_sessions").update({ is_current: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

const TERM_SELECT = "*, academic_sessions(name)";

export async function listTerms(filter?: { sessionId?: string }): Promise<Term[]> {
  let q = serviceClient().from("terms").select(TERM_SELECT).order("created_at", { ascending: true });
  if (filter?.sessionId) q = q.eq("session_id", filter.sessionId);
  const { data } = await q;
  return (data ?? []).map(mapTerm);
}

export async function createTerm(input: {
  sessionId: string;
  name: Term["name"];
}): Promise<Term> {
  const { data, error } = await serviceClient()
    .from("terms")
    .insert({ session_id: input.sessionId, name: input.name })
    .select(TERM_SELECT)
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error("That term already exists for the session");
    }
    throw new Error(error.message);
  }
  return mapTerm(data);
}

/** Make `id` the current term, unsetting any prior current term first. */
export async function setCurrentTerm(id: string): Promise<void> {
  const supa = serviceClient();
  const { error: unsetErr } = await supa.from("terms").update({ is_current: false }).eq("is_current", true);
  if (unsetErr) throw new Error(unsetErr.message);
  const { error } = await supa.from("terms").update({ is_current: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getCurrentTerm(): Promise<Term | null> {
  const { data } = await serviceClient()
    .from("terms")
    .select(TERM_SELECT)
    .eq("is_current", true)
    .maybeSingle();
  return data ? mapTerm(data) : null;
}

export async function getTermById(id: string): Promise<Term | null> {
  const { data } = await serviceClient()
    .from("terms")
    .select(TERM_SELECT)
    .eq("id", id)
    .maybeSingle();
  return data ? mapTerm(data) : null;
}
