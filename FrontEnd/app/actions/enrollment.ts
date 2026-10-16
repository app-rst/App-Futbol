"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string };

/** Anotarse desde el link de invitación. El rol (titular/suplente) lo define el orden de llegada. */
export async function joinMatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getUserClaims())) redirect("/login");
  const code = String(formData.get("invite_code") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_match_by_code", { p_invite_code: code });
  if (error || !data) return { error: dbErrorMessage(error, "No te pudimos anotar. Volvé a intentar.") };

  const matchId = (data as { match_id: string }).match_id;
  revalidatePath("/");
  redirect(`/partidos/${matchId}?anotado=1`);
}

export async function leaveMatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getUserClaims())) redirect("/login");
  const matchId = String(formData.get("match_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_match", { p_match_id: matchId });
  if (error) return { error: dbErrorMessage(error, "No te pudimos bajar. Volvé a intentar.") };

  revalidatePath("/");
  redirect("/?baja=1");
}

export async function removePlayer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getUserClaims())) redirect("/login");
  const matchId = String(formData.get("match_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_player", { p_match_id: matchId, p_user_id: userId });
  if (error) return { error: dbErrorMessage(error, "No se pudo sacar al jugador.") };

  revalidatePath(`/partidos/${matchId}`);
  return {};
}
