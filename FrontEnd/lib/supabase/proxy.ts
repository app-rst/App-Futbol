import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

/** Refresca la sesión de Supabase en cada request y devuelve la respuesta con las cookies actualizadas. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // No poner código entre createServerClient y getClaims: getClaims valida el
  // JWT y dispara el refresh del token si hace falta.
  const { data } = await supabase.auth.getClaims();

  return { response, userId: (data?.claims?.sub as string | undefined) ?? null };
}
