import Link from "next/link";
import { MatchCard } from "@/components/match/match-card";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button-styles";
import { getMyProfile } from "@/lib/auth";
import { isPast, matchPhase } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { MyMatch } from "@/lib/types";

function roleLabel(m: MyMatch) {
  const parts: string[] = [];
  if (m.is_admin) parts.push("Sos el admin");
  if (m.my_position !== null) {
    parts.push(
      m.my_position <= m.starters_count ? "Titular" : `Suplente #${m.my_position - m.starters_count}`,
    );
  }
  return parts.join(" · ");
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const { baja } = await searchParams;
  const profile = await getMyProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_matches");
  const matches = (data ?? []) as MyMatch[];

  // Próximos = todavía no pasaron (incluye "en juego" y la votación de 24 h).
  const upcoming = matches.filter((m) => {
    const phase = matchPhase(m);
    return phase === "upcoming" || phase === "playing" || phase === "voting" ||
      (phase === "cancelled" && !isPast(m.starts_at));
  });

  const name = profile?.nickname ?? profile?.first_name;
  return (
    <>
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm opacity-60">Hola{name ? `, ${name}` : ""} 👋</p>
          <h1 className="text-2xl font-bold">Tus partidos</h1>
        </div>
        <Link href="/partidos/nuevo" className={buttonClass("primary", "h-10 px-3 text-sm")}>
          + Crear
        </Link>
      </header>

      {baja && <Alert kind="success">Te bajaste del partido.</Alert>}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          No se pudieron cargar tus partidos.
        </p>
      )}

      {!error && upcoming.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-black/15 p-8 text-center dark:border-white/15">
          <p className="text-4xl" aria-hidden>
            🥅
          </p>
          <p className="font-semibold">No tenés partidos próximos</p>
          <p className="text-sm opacity-70">Creá uno y compartilo por WhatsApp, o pedile el link a quien lo organiza.</p>
          <Link href="/partidos/nuevo" className={buttonClass("primary", "w-full")}>
            Crear partido
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {upcoming.map((m) => (
            <li key={m.id}>
              <MatchCard match={m} extra={<p className="text-xs font-medium text-green-800 dark:text-green-300">{roleLabel(m)}</p>} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
