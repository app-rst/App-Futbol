"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AdminActionState = { error?: string };

/** Bloquea o desbloquea un usuario. La RPC valida que quien llama sea admin del sistema. */
export async function setUserBlocked(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const userId = String(formData.get("user_id") ?? "");
  const blocked = formData.get("blocked") === "true";
  if (!userId) return { error: "Falta el usuario." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_blocked", { p_user_id: userId, p_blocked: blocked });
  if (error) {
    // Los mensajes de la base (P0001/P0002/42501) ya están en castellano.
    return { error: ["P0001", "P0002", "42501"].includes(error.code) ? error.message : "No se pudo actualizar el usuario." };
  }

  revalidatePath("/admin");
  return {};
}
