"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsOf, formValues, profileSchema, type FormState } from "@/lib/validators";

/** Guarda el perfil propio. Si viene `next` (onboarding), redirige al terminar. */
export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const claims = await getUserClaims();
  if (!claims) redirect("/login");

  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update(parsed.data).eq("id", claims.id).select("id");
  // Sin filas actualizadas = el perfil no existe: no hay que decir "guardado".
  if (error || !data?.length) {
    if (error) console.error("saveProfile", error);
    return { error: "No pudimos guardar tus datos. Volvé a intentar.", values };
  }

  revalidatePath("/", "layout");
  const next = formData.get("next");
  if (typeof next === "string" && next) redirect(safeNext(next));
  return { success: "Datos guardados." };
}
