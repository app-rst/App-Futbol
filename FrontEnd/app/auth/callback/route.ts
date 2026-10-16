import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino de todos los links de auth:
 * - Google OAuth y links de email con PKCE → ?code=...
 * - Links de email con token_hash (plantilla recomendada en el README, sirve
 *   aunque el link se abra en otro dispositivo) → ?token_hash=...&type=...
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  if (!ok) {
    return NextResponse.redirect(new URL(`/login?error=link&next=${encodeURIComponent(next)}`, request.url));
  }
  const target = type === "recovery" ? "/recuperar/nueva" : next;
  return NextResponse.redirect(new URL(target, request.url));
}
