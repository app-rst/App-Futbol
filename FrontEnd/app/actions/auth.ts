"use server";

import { redirect } from "next/navigation";
import { siteOrigin } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import {
  emailSchema,
  fieldErrorsOf,
  formValues,
  loginSchema,
  newPasswordSchema,
  signUpSchema,
  type FormState,
} from "@/lib/validators";

const PASSWORDS = ["password", "password_confirm"];

function callbackUrl(origin: string, next: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, PASSWORDS);
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error), values };

  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, PASSWORDS);
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const { email, password, first_name, last_name, nickname, phone } = parsed.data;
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // El trigger handle_new_user crea el perfil con estos datos.
      data: { first_name, last_name, nickname, phone },
      emailRedirectTo: callbackUrl(await siteOrigin(), next),
    },
  });
  if (error) return { error: authErrorMessage(error), values };

  // Con confirmación de email activada, Supabase no revela si el email ya
  // existía: devuelve un usuario sin identidades.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "Ya existe una cuenta con ese email. Probá iniciar sesión.", values };
  }
  // Confirmación de email desactivada: ya hay sesión.
  if (data.session) redirect(next);

  return {
    success: `Te mandamos un email a ${email} para confirmar tu cuenta. Abrí el link desde este dispositivo.`,
  };
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(await siteOrigin(), next) },
  });
  if (error || !data.url) redirect(`/login?error=google&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl(await siteOrigin(), "/recuperar/nueva"),
  });
  if (error?.code === "over_email_send_rate_limit") return { error: authErrorMessage(error), values };

  // Mismo mensaje exista o no la cuenta (no revelamos qué emails están registrados).
  return { success: "Si hay una cuenta con ese email, te llegó un link para elegir una contraseña nueva." };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage(error) };

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
