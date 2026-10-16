import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * "Despertador" del proyecto gratuito de Supabase (se pausa tras 1 semana sin
 * actividad). Lo llama una vez por día el Cron de Vercel (ver vercel.json),
 * que manda `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const supabase = createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("ping");
  if (error || data !== true) {
    console.error("keepalive", error);
    return Response.json({ ok: false }, { status: 502 });
  }
  return Response.json({ ok: true });
}
