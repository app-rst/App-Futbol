"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsOf, formValues, matchFormSchema, type FormState } from "@/lib/validators";

export async function createMatch(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  if (!(await getUserClaims())) redirect("/login");

  const parsed = matchFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const duplicatedFrom = String(formData.get("duplicated_from") ?? "") || null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_match", {
    ...parsed.data,
    p_duplicated_from: duplicatedFrom,
  });
  if (error || !data) return { error: dbErrorMessage(error, "No se pudo crear el partido."), values };

  revalidatePath("/");
  redirect(`/partidos/${data as string}?creado=1`);
}

export async function updateMatch(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  if (!(await getUserClaims())) redirect("/login");

  const matchId = String(formData.get("match_id") ?? "");
  const parsed = matchFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_match", { p_match_id: matchId, ...parsed.data });
  if (error) return { error: dbErrorMessage(error, "No se pudo guardar el partido."), values };

  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/");
  redirect(`/partidos/${matchId}`);
}
