import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { Campus } from "@/lib/types";

type Row = Record<string, unknown>;

function mapCampus(r: Row): Campus {
  return {
    id: r.id as string,
    name: r.name as string,
    createdAt: r.created_at as string,
  };
}

export async function listCampuses(): Promise<Campus[]> {
  const { data } = await serviceClient()
    .from("campuses")
    .select("*")
    .order("name", { ascending: true });
  return (data ?? []).map(mapCampus);
}

export async function createCampus(name: string): Promise<Campus> {
  const { data, error } = await serviceClient()
    .from("campuses")
    .insert({ name })
    .select("*")
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error("A campus with that name already exists");
    }
    throw new Error(error.message);
  }
  return mapCampus(data);
}

export async function deleteCampus(id: string): Promise<void> {
  const { error } = await serviceClient().from("campuses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
