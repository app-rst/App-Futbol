import { PhaseBadge } from "@/components/match/phase-badge";
import { costPerPlayer, formatARS } from "@/lib/cost";
import { formatDateTime, formatMatchWhen, isPast, matchPhase } from "@/lib/dates";
import type { Match } from "@/lib/types";

/** Encabezado con lugar, fecha, costo y límite de inscripción. */
export function MatchSummary({ match }: { match: Match }) {
  const phase = matchPhase(match);
  const perPlayer = costPerPlayer(Number(match.field_cost), match.starters_count);
  const deadlinePassed = isPast(match.signup_deadline);

  return (
    <section className="flex flex-col gap-3">
      <div>
        <PhaseBadge phase={phase} />
        <h1 className="mt-1 text-2xl font-bold leading-tight">{match.location}</h1>
        <p className="text-sm opacity-70">{formatMatchWhen(match.starts_at, match.ends_at)}</p>
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-green-700/10 px-3 py-2 text-green-900 dark:text-green-200">
          <dt className="text-xs opacity-70">Por jugador</dt>
          <dd className="text-xl font-bold">{perPlayer !== null ? formatARS(perPlayer) : "—"}</dd>
          <dd className="text-xs opacity-70">
            Cancha {formatARS(Number(match.field_cost))} ÷ {match.starters_count}
          </dd>
        </div>
        <div className="rounded-xl bg-black/[0.04] px-3 py-2 dark:bg-white/5">
          <dt className="text-xs opacity-70">Límite de inscripción</dt>
          <dd className="text-sm font-semibold">{formatDateTime(match.signup_deadline)}</dd>
          {deadlinePassed && phase === "upcoming" && (
            <dd className="text-xs opacity-70">Ya pasó, pero todavía te podés anotar.</dd>
          )}
        </div>
      </dl>
    </section>
  );
}
