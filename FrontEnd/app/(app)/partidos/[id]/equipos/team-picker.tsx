"use client";

import { useActionState, useState } from "react";
import { saveTeams } from "@/app/actions/admin-tools";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { teamLabel, type TeamNames } from "@/lib/teams";

type Team = "A" | "B" | null;
type Player = { user_id: string; display_name: string; position: number; team: Team };

const TEAM_STYLE = {
  A: "bg-sky-600 text-white border-sky-600",
  B: "bg-orange-500 text-white border-orange-500",
} as const;

/**
 * Nombres de los equipos y asignar cada titular al A o al B (botones grandes,
 * pensados para el celular). Con el resultado cargado (`namesOnly`), solo se
 * pueden cambiar los nombres.
 */
export function TeamPicker({
  matchId,
  starters,
  names: initialNames,
  namesOnly = false,
}: {
  matchId: string;
  starters: Player[];
  names: TeamNames;
  namesOnly?: boolean;
}) {
  const [state, action] = useActionState(saveTeams, {});
  const [names, setNames] = useState({ A: initialNames.A ?? "", B: initialNames.B ?? "" });
  const shown: TeamNames = { A: names.A.trim() || null, B: names.B.trim() || null };
  const [teams, setTeams] = useState<Record<string, Team>>(
    () => Object.fromEntries(starters.map((p) => [p.user_id, p.team])),
  );

  const countA = Object.values(teams).filter((t) => t === "A").length;
  const countB = Object.values(teams).filter((t) => t === "B").length;
  const unassigned = starters.length - countA - countB;

  function toggle(userId: string, team: "A" | "B") {
    setTeams((prev) => ({ ...prev, [userId]: prev[userId] === team ? null : team }));
  }

  function shuffle() {
    // Reparto al azar, lo más parejo posible.
    const ids = starters.map((p) => p.user_id).sort(() => Math.random() - 0.5);
    setTeams(Object.fromEntries(ids.map((id, i) => [id, i % 2 === 0 ? "A" : "B"])));
  }

  const assignments = JSON.stringify(starters.map((p) => ({ user_id: p.user_id, team: teams[p.user_id] ?? null })));

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="match_id" value={matchId} />
      {!namesOnly && <input type="hidden" name="assignments" value={assignments} />}
      <Alert kind="error">{state.error}</Alert>

      <div className="grid grid-cols-2 gap-3">
        {(["A", "B"] as const).map((t) => (
          <Field
            key={t}
            label={`Nombre del equipo ${t}`}
            name={`team_${t.toLowerCase()}_name`}
            maxLength={30}
            placeholder={`Equipo ${t}`}
            value={names[t]}
            onChange={(ev) => setNames((n) => ({ ...n, [t]: ev.target.value }))}
            hint="Opcional."
          />
        ))}
      </div>

      {!namesOnly && (
        <>

      <div className="sticky top-0 z-10 grid grid-cols-3 gap-2 bg-[var(--background)] py-2 text-center text-sm">
        <div className="rounded-xl bg-sky-600/10 py-2">
          <p className="text-2xl font-bold text-sky-700 dark:text-sky-300">{countA}</p>
          <p className="truncate px-1 text-xs opacity-70">{teamLabel(shown, "A")}</p>
        </div>
        <div className="rounded-xl bg-orange-500/10 py-2">
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-300">{countB}</p>
          <p className="truncate px-1 text-xs opacity-70">{teamLabel(shown, "B")}</p>
        </div>
        <div className="rounded-xl bg-black/5 py-2 dark:bg-white/10">
          <p className="text-2xl font-bold">{unassigned}</p>
          <p className="text-xs opacity-70">Sin equipo</p>
        </div>
      </div>

      <button type="button" onClick={shuffle} className="self-start text-sm underline underline-offset-4 opacity-70">
        🎲 Armar al azar
      </button>

      <ul className="flex flex-col gap-2">
        {starters.map((p) => (
          <li
            key={p.user_id}
            className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-2 pl-3 dark:border-white/10 dark:bg-white/5"
          >
            <span className="w-5 text-right text-sm tabular-nums opacity-50">{p.position}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{p.display_name}</span>
            {(["A", "B"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggle(p.user_id, t)}
                aria-pressed={teams[p.user_id] === t}
                aria-label={`${p.display_name}: ${teamLabel(shown, t)}`}
                className={`size-11 rounded-lg border text-base font-bold transition ${
                  teams[p.user_id] === t ? TEAM_STYLE[t] : "border-black/15 opacity-60 dark:border-white/20"
                }`}
              >
                {t}
              </button>
            ))}
          </li>
        ))}
      </ul>

      {unassigned > 0 && (
        <p className="text-xs opacity-70">
          Podés guardar con jugadores sin equipo, pero para cargar el resultado van a tener que estar todos asignados.
        </p>
      )}
        </>
      )}
      <SubmitButton pendingText="Guardando…">{namesOnly ? "Guardar nombres" : "Guardar equipos"}</SubmitButton>
    </form>
  );
}
