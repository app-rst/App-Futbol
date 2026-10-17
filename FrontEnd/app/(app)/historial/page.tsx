import Link from "next/link";
import { buttonClass } from "@/components/ui/button-styles";
import { formatDate, formatMatchWhen } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { HistoryMatch } from "@/lib/types";

export const metadata = { title: "Historial" };

const TEAM_TEXT = { A: "text-sky-700 dark:text-sky-300", B: "text-orange-600 dark:text-orange-300" } as const;

function outcome(m: HistoryMatch): { label: string; style: string } | null {
  const { loaded, team_a_goals: a, team_b_goals: b } = m.result;
  if (!loaded || a === null || b === null || !m.my_team) return null;
  if (a === b) return { label: "Empate", style: "bg-black/10 dark:bg-white/15" };
  const won = (m.my_team === "A" && a > b) || (m.my_team === "B" && b > a);
  return won
    ? { label: "Ganaste", style: "bg-green-700 text-white" }
    : { label: "Perdiste", style: "bg-red-600/15 text-red-700 dark:text-red-300" };
}

function HistoryCard({ m }: { m: HistoryMatch }) {
  const res = outcome(m);
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/partidos/${m.id}`} className="block truncate font-semibold underline-offset-2 hover:underline">
            {m.location}
          </Link>
          <p className="text-xs opacity-60">{formatMatchWhen(m.starts_at, m.ends_at)}</p>
        </div>
        {res && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${res.style}`}>{res.label}</span>}
      </header>

      {m.result.loaded ? (
        <div className="flex items-center justify-center gap-3">
          {(["A", "B"] as const).map((t, i) => (
            <div key={t} className="flex items-center gap-3">
              {i === 1 && <span className="opacity-30">–</span>}
              <div className="text-center">
                <p className={`text-xs font-bold ${TEAM_TEXT[t]}`}>
                  Equipo {t}
                  {m.my_team === t && " (vos)"}
                </p>
                <p className="text-3xl font-black tabular-nums">{t === "A" ? m.result.team_a_goals : m.result.team_b_goals}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm opacity-60">Sin resultado cargado</p>
      )}

      {m.scorers.length > 0 && (
        <p className="text-sm">
          {m.scorers.map((s, i) => (
            <span key={`${s.display_name}-${i}`} className="mr-2 inline-block">
              ⚽ {s.display_name}
              {s.goals > 1 && <span className="opacity-60"> ×{s.goals}</span>}
            </span>
          ))}
        </p>
      )}

      <p className="text-sm">
        🏆{" "}
        {m.mvp === null ? (
          <span className="opacity-60">Votación del MVP abierta</span>
        ) : m.mvp.length === 0 ? (
          <span className="opacity-60">Sin MVP (nadie votó)</span>
        ) : (
          <strong>{m.mvp.map((x) => x.display_name).join(" y ")}</strong>
        )}
      </p>

      {(m.teams.A.length > 0 || m.teams.B.length > 0) && (
        <details className="text-sm">
          <summary className="cursor-pointer select-none opacity-70">Ver equipos</summary>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(["A", "B"] as const).map((t) => (
              <ul key={t}>
                <li className={`font-bold ${TEAM_TEXT[t]}`}>Equipo {t}</li>
                {m.teams[t].map((name, i) => (
                  <li key={`${name}-${i}`} className="truncate">
                    {name}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_history");
  const matches = (data ?? []) as HistoryMatch[];

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold">Historial</h1>
        <p className="text-sm opacity-60">Los partidos que jugaste como titular.</p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          No se pudo cargar tu historial.
        </p>
      ) : matches.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-black/15 p-8 text-center dark:border-white/15">
          <p className="text-4xl" aria-hidden>
            📜
          </p>
          <p className="font-semibold">Todavía no jugaste ningún partido</p>
          <p className="text-sm opacity-70">Cuando termine un partido en el que estuviste como titular, va a aparecer acá.</p>
          <Link href="/" className={buttonClass("secondary", "w-full")}>
            Ver próximos partidos
          </Link>
        </div>
      ) : (
        <>
          <p className="text-xs opacity-60">
            {matches.length} partido{matches.length === 1 ? "" : "s"} · desde el {formatDate(matches[matches.length - 1].starts_at)}
          </p>
          <ul className="flex flex-col gap-3">
            {matches.map((m) => (
              <li key={m.id}>
                <HistoryCard m={m} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
