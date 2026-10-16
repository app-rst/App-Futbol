import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type MyProfile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  phone: string | null;
  isComplete: boolean;
  /** Superusuario de la app (tabla system_admins). */
  isSystemAdmin: boolean;
  /** Cuenta bloqueada por un admin (su token puede seguir vigente hasta 1 h). */
  isBlocked: boolean;
};

/** Usuario logueado según el JWT validado, o null. Se memoiza por request. */
export const getUserClaims = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub as string,
    email: (claims.email as string | undefined) ?? null,
    /** Datos cargados al registrarse (o los de Google). Sirven para precargar el onboarding. */
    metadata: (claims.user_metadata ?? {}) as Record<string, unknown>,
  };
});

export const getMyProfile = cache(async (): Promise<MyProfile | null> => {
  const claims = await getUserClaims();
  if (!claims) return null;
  const supabase = await createClient();
  const [{ data, error }, { data: flags, error: flagsError }] = await Promise.all([
    supabase.from("profiles").select("id, first_name, last_name, nickname, phone").eq("id", claims.id).maybeSingle(),
    supabase.rpc("my_account_flags").maybeSingle<{ is_system_admin: boolean; is_blocked: boolean }>(),
  ]);
  // Un error de base de datos (p. ej. migraciones sin aplicar) no debe
  // confundirse con "perfil incompleto": se muestra app/error.tsx.
  if (error || flagsError) {
    console.error("getMyProfile", error ?? flagsError);
    throw new Error("No pudimos cargar tu perfil.");
  }
  if (!data) return null;
  return {
    ...data,
    email: claims.email,
    isComplete: Boolean(data.first_name && data.last_name && data.phone),
    isSystemAdmin: flags?.is_system_admin ?? false,
    isBlocked: flags?.is_blocked ?? false,
  };
});

/** Ruta actual (la pone proxy.ts en x-pathname) para volver después del login u onboarding. */
export async function currentPath(): Promise<string> {
  return (await headers()).get("x-pathname") ?? "/";
}

export async function requireUser() {
  const claims = await getUserClaims();
  if (!claims) redirect(`/login?next=${encodeURIComponent(await currentPath())}`);
  return claims;
}

/**
 * Exige sesión, cuenta no bloqueada y perfil completo; si falta algo manda a
 * login, /suspendida u onboarding. El admin del sistema no necesita celular
 * (no se anota a partidos), así que no pasa por el onboarding.
 */
export async function requireCompleteProfile(): Promise<MyProfile> {
  await requireUser();
  const profile = await getMyProfile();
  if (profile?.isBlocked) redirect("/suspendida");
  if (!profile || (!profile.isComplete && !profile.isSystemAdmin)) {
    redirect(`/onboarding?next=${encodeURIComponent(await currentPath())}`);
  }
  return profile;
}

/** Solo admins del sistema; para el resto la página "no existe". */
export async function requireSystemAdmin(): Promise<MyProfile> {
  const profile = await requireCompleteProfile();
  if (!profile.isSystemAdmin) notFound();
  return profile;
}

/** Origen público de la app (para los links de email y OAuth). */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}
