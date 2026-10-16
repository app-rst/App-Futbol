"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string };

async function requireSession() {
  if (!(await getUserClaims())) redirect("/login");
}

function goals(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
}

export async function saveResult(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const matchId = String(formData.get("match_id") ?? "");
  const a = goals(formData.get("team_a_goals"));
  const b = goals(formData.get("team_b_goals"));
  if (a === null || b === null) return { error: "Los goles tienen que ser un número entre 0 y 99." };

  let scorers: unknown;
  try {
    scorers = JSON.parse(String(formData.get("scorers") ?? "[]"));
  } catch {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_result", {
    p_match_id: matchId,
    p_team_a_goals: a,
    p_team_b_goals: b,
    p_scorers: scorers,
  });
  if (error) return { error: dbErrorMessage(error, "No se pudo guardar el resultado.") };

  revalidatePath(`/partidos/${matchId}`);
  redirect(`/partidos/${matchId}?resultado=1`);
}

export async function castVote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const matchId = String(formData.get("match_id") ?? "");
  const candidate = String(formData.get("candidate") ?? "");
  if (!candidate) return { error: "Elegí a quién votar." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cast_mvp_vote", { p_match_id: matchId, p_candidate: candidate });
  if (error) return { error: dbErrorMessage(error, "No se pudo registrar tu voto.") };

  revalidatePath(`/partidos/${matchId}`);
  redirect(`/partidos/${matchId}?votado=1`);
}
