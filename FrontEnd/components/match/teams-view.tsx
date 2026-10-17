import { teamLabel, type TeamNames } from "@/lib/teams";
import type { RosterEntry } from "@/lib/types";

const STYLE = {
  A: { box: "border-sky-600/30 bg-sky-600/5", title: "text-sky-700 dark:text-sky-300" },
  B: { box: "border-orange-500/30 bg-orange-500/5", title: "text-orange-600 dark:text-orange-300" },
} as const;

/** Los dos equipos lado a lado (solo si el admin ya asignó a alguien). */
export function TeamsView({ roster, names }: { roster: RosterEntry[]; names: TeamNames }) {
  const starters = roster.filter((p) => p.is_starter);
  if (!starters.some((p) => p.team)) return null;
  const unassigned = starters.filter((p) => !p.team);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">Equipos</h2>
      <div className="grid grid-cols-2 gap-2">
        {(["A", "B"] as const).map((t) => {
          const players = starters.filter((p) => p.team === t);
          return (
            <div key={t} className={`rounded-xl border p-3 ${STYLE[t].box}`}>
              <p className={`text-sm font-bold ${STYLE[t].title}`}>
                {teamLabel(names, t)} <span className="font-normal opacity-70">({players.length})</span>
              </p>
              <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                {players.map((p) => (
                  <li key={p.user_id} className="truncate">
                    {p.display_name}
                    {p.is_me && <span className="opacity-60"> (vos)</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {unassigned.length > 0 && (
        <p className="text-xs opacity-70">
          Sin equipo: {unassigned.map((p) => p.display_name).join(", ")}
        </p>
      )}
    </section>
  );
}
