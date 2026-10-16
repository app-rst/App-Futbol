import Link from "next/link";
import { MatchCard } from "@/components/match/match-card";
import { createClient } from "@/lib/supabase/server";
import type { AdminMatch } from "@/lib/types";

export const MATCH_FILTERS = {
  upcoming: "Próximos",
  past: "Jugados",
  cancelled: "Cancelados",
  all: "Todos",
} as const;

export type MatchFilter = keyof typeof MATCH_FILTERS;

export async function MatchesTab({ filter }: { filter: MatchFilter }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_matches", { p_filter: filter });
  const matches = (data ?? []) as AdminMatch[];

  return (
    <>
      <nav aria-label="Filtro" className="flex flex-wrap gap-2">
        {(Object.keys(MATCH_FILTERS) as MatchFilter[]).map((f) => (
          <Link
            key={f}
            href={`/admin?tab=partidos&filtro=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-sm ${
              f === filter ? "bg-green-700 font-semibold text-white" : "bg-black/5 dark:bg-white/10"
            }`}
          >
            {MATCH_FILTERS[f]}
          </Link>
        ))}
      </nav>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          No se pudo cargar el listado de partidos.
        </p>
      ) : (
        <section aria-label="Partidos" className="flex flex-col gap-3">
          <p className="text-xs opacity-60">
            {matches.length} partido{matches.length === 1 ? "" : "s"}
          </p>
          {matches.length === 0 && <p className="text-sm opacity-70">No hay partidos en esta categoría.</p>}
          {matches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              extra={<p className="text-xs opacity-70">Admin: {m.admin_name ?? "—"}</p>}
            />
          ))}
        </section>
      )}
    </>
  );
}
