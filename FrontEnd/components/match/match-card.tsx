import Link from "next/link";
import { PhaseBadge } from "@/components/match/phase-badge";
import { formatDay, formatTime, matchPhase } from "@/lib/dates";

type CardMatch = {
  id: string;
  location: string;
  starts_at: string;
  ends_at: string;
  status: "open" | "cancelled";
  starters_count: number;
  players_count: number;
};

/** Tarjeta de partido para los listados. `extra` muestra info del usuario (rol, admin, etc.). */
export function MatchCard({ match, extra }: { match: CardMatch; extra?: React.ReactNode }) {
  const phase = matchPhase(match);
  const starters = Math.min(match.players_count, match.starters_count);
  const subs = Math.max(match.players_count - match.starters_count, 0);
  return (
    <Link
      href={`/partidos/${match.id}`}
      className="flex gap-3 rounded-2xl border border-black/10 bg-white p-3 transition active:scale-[0.99] dark:border-white/10 dark:bg-white/5"
    >
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-green-700/10 py-2 text-green-900 dark:text-green-200">
        <span className="text-xs">{formatDay(match.starts_at).split(" ")[0]}</span>
        <span className="text-xl font-bold leading-none">{formatDay(match.starts_at).split(" ")[1]}</span>
        <span className="text-xs">{formatTime(match.starts_at)}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-semibold">📍 {match.location}</p>
          <PhaseBadge phase={phase} />
        </div>
        <p className="text-sm opacity-70">
          {starters}/{match.starters_count} titulares{subs > 0 ? ` · ${subs} suplente${subs === 1 ? "" : "s"}` : ""}
        </p>
        {extra}
      </div>
    </Link>
  );
}
