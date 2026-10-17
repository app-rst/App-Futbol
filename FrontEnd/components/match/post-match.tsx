import Link from "next/link";
import { MvpVoteForm } from "@/components/match/mvp-vote-form";
import { buttonClass } from "@/components/ui/button-styles";
import { formatDateTime } from "@/lib/dates";
import type { MatchPost } from "@/lib/types";

/** Marcador y goleadores. */
export function ResultCard({ post, matchId, isAdmin }: { post: MatchPost; matchId: string; isAdmin: boolean }) {
  const { result, scorers } = post;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <h2 className="text-sm font-semibold opacity-70">Resultado</h2>
      {result.loaded ? (
        <>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-xs font-bold text-sky-700 dark:text-sky-300">Equipo A</p>
              <p className="text-5xl font-black tabular-nums">{result.team_a_goals}</p>
            </div>
            <span className="text-3xl opacity-30">–</span>
            <div className="text-center">
              <p className="text-xs font-bold text-orange-600 dark:text-orange-300">Equipo B</p>
              <p className="text-5xl font-black tabular-nums">{result.team_b_goals}</p>
            </div>
          </div>
          {scorers.length > 0 && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {(["A", "B"] as const).map((t) => (
                <ul key={t} className={`flex flex-col gap-0.5 ${t === "B" ? "text-right" : ""}`}>
                  {scorers
                    .filter((s) => s.team === t)
                    .map((s) => (
                      <li key={s.user_id}>
                        ⚽ {s.display_name}
                        {s.goals > 1 && <span className="opacity-60"> ×{s.goals}</span>}
                      </li>
                    ))}
                </ul>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm opacity-70">
          {isAdmin ? "Todavía no cargaste el resultado." : "El admin todavía no cargó el resultado."}
        </p>
      )}
      {isAdmin && (
        <Link href={`/partidos/${matchId}/resultado`} className={buttonClass(result.loaded ? "secondary" : "primary")}>
          {result.loaded ? "✏️ Editar resultado" : "Cargar resultado"}
        </Link>
      )}
    </section>
  );
}

/** Votación del MVP: anónima, solo titulares, 24 h desde el fin. */
export function MvpSection({ post, matchId, startersCount }: { post: MatchPost; matchId: string; startersCount: number }) {
  const { voting, mvp } = post;
  // Hay MVP solo si vota al menos la mitad de los titulares (ver match_mvp_winners).
  const minVotes = Math.ceil(startersCount / 2);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-400/10 p-4">
      <h2 className="font-semibold">🏆 MVP del partido</h2>

      {voting.is_closed ? (
        mvp && mvp.length > 0 ? (
          <div>
            <p className="text-2xl font-black">{mvp.map((m) => m.display_name).join(" y ")}</p>
            {mvp.length > 1 && <p className="text-sm opacity-70">Empate: compartieron el MVP.</p>}
          </div>
        ) : (
          <p className="text-sm opacity-80">Sin MVP: votaron menos de {minVotes} titulares.</p>
        )
      ) : voting.is_open ? (
        <>
          <p className="text-sm opacity-80">
            La votación cierra el <strong>{formatDateTime(voting.closes_at)}</strong>. Después se muestra el ganador.
            Para que haya MVP tienen que votar al menos {minVotes} titulares.
          </p>
          {voting.has_voted ? (
            <p className="font-semibold text-green-800 dark:text-green-300">✓ Ya votaste. ¡Gracias!</p>
          ) : voting.can_vote ? (
            <>
              <p className="text-xs opacity-70">
                🔒 Es anónimo: nadie, ni el admin, puede ver a quién votaste. Votar es opcional.
              </p>
              <MvpVoteForm matchId={matchId} candidates={voting.candidates} />
            </>
          ) : (
            <p className="text-sm opacity-70">
              {voting.is_starter ? "No podés votar en este partido." : "Solo votan los titulares del partido."}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm opacity-70">La votación se abre cuando termina el partido y dura 24 horas.</p>
      )}
    </section>
  );
}
