import "server-only";
import { notFound } from "next/navigation";
import { formatMatchWhen } from "@/lib/dates";
import { isNotFound } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import type { Match, MatchView } from "@/lib/types";

/** Vista del partido por id o por código de invitación. 404 si no existe o no tenés acceso. */
export async function getMatchView(by: { id: string } | { code: string }): Promise<MatchView> {
  const supabase = await createClient();
  const args = "id" in by ? { p_match_id: by.id } : { p_invite_code: by.code };
  const { data, error } = await supabase.rpc("get_match_view", args);
  if (isNotFound(error) || (error?.code === "22P02" && "id" in by)) notFound(); // 22P02: uuid inválido
  if (error || !data) throw new Error("No se pudo cargar el partido.");
  return data as MatchView;
}

/** Texto para compartir por WhatsApp. */
export function shareText(m: Pick<Match, "location" | "starts_at" | "ends_at">): string {
  return `⚽ ¡Partido! ${formatMatchWhen(m.starts_at, m.ends_at)} en ${m.location}. Anotate acá:`;
}
