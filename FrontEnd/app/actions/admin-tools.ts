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

export async function cancelMatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const matchId = String(formData.get("match_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_match", { p_match_id: matchId });
  if (error) return { error: dbErrorMessage(error, "No se pudo cancelar el partido.") };

  revalidatePath("/");
  revalidatePath(`/partidos/${matchId}`);
  return {};
}

export async function transferAdminAndLeave(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const matchId = String(formData.get("match_id") ?? "");
  const newAdmin = String(formData.get("new_admin") ?? "");
  if (!newAdmin) return { error: "Elegí quién va a ser el nuevo admin." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_admin_and_leave", { p_match_id: matchId, p_new_admin: newAdmin });
  if (error) return { error: dbErrorMessage(error, "No se pudo pasar el admin.") };

  revalidatePath("/");
  redirect("/?baja=1");
}

export async function saveTeams(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const matchId = String(formData.get("match_id") ?? "");
  let assignments: unknown;
  try {
    assignments = JSON.parse(String(formData.get("assignments") ?? "[]"));
  } catch {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_teams", { p_match_id: matchId, p_assignments: assignments });
  if (error) return { error: dbErrorMessage(error, "No se pudieron guardar los equipos.") };

  revalidatePath(`/partidos/${matchId}`);
  redirect(`/partidos/${matchId}?equipos=1`);
}
