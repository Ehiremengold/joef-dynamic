import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { Candidate } from "@/lib/types";

type Row = Record<string, unknown>;

function mapCandidate(r: Row): Candidate {
  return {
    id: r.id as string,
    candidateNumber: r.candidate_number as string,
    fullName: r.full_name as string,
    parentPhone: (r.parent_phone as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

/** Sequential-ish candidate number, e.g. JDC/2026/000123. */
function candidateNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `JDC/${year}/${rand}`;
}

export async function registerCandidate(input: {
  fullName: string;
  parentPhone: string | null;
}): Promise<Candidate> {
  const { data, error } = await serviceClient()
    .from("candidates")
    .insert({
      candidate_number: candidateNumber(),
      full_name: input.fullName,
      parent_phone: input.parentPhone,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCandidate(data);
}

/** Batch lookup, used to attach candidate numbers to a list of attempts. */
export async function getCandidatesByIds(ids: string[]): Promise<Candidate[]> {
  if (ids.length === 0) return [];
  const { data } = await serviceClient().from("candidates").select("*").in("id", ids);
  return (data ?? []).map(mapCandidate);
}

export async function getCandidateById(id: string): Promise<Candidate | null> {
  const { data } = await serviceClient()
    .from("candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapCandidate(data) : null;
}
