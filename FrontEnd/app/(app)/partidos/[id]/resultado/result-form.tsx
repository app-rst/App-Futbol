"use client";

import { useActionState, useState } from "react";
import { saveResult } from "@/app/actions/results";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";
import { teamLabel, type TeamNames } from "@/lib/teams";

type Player = { user_id: string; display_name: string; team: "A" | "B" };

const TEAM = {
  A: { title: "text-sky-700 dark:text-sky-300", box: "border-sky-600/30 bg-sky-600/5" },
  B: { title: "text-orange-600 dark:text-orange-300", box: "border-orange-500/30 bg-orange-500/5" },
} as const;

function Stepper({ value, onChange, label, big = false }: { value: number; onChange: (n: number) => void; label: string; big?: boolean }) {
  const size = big ? "size-12 text-2xl" : "size-9 text-lg";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        aria-label={`Restar gol: ${label}`}
        className={`${size} rounded-lg border border-black/15 font-bold disabled:opacity-30 dark:border-white/20`}
      >
        −
      </button>
      <span className={`${big ? "w-10 text-4xl" : "w-6 text-lg"} text-center font-bold tabular-nums`} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(99, value + 1))}
        aria-label={`Sumar gol: ${label}`}
        className={`${size} rounded-lg border border-black/15 font-bold dark:border-white/20`}
      >
        +
      </button>
    </div>
  );
}

export function ResultForm({
  matchId,
  players,
  initial,
  locked,
  names,
}: {
  matchId: string;
  players: Player[];
  initial: { a: number; b: number; scorers: Record<string, number> };
  /** Resultado ya guardado: el marcador queda fijo y solo se editan los goleadores. */
  locked: boolean;
  names: TeamNames;
}) {
  const [state, action] = useActionState(saveResult, {});
  const [score, setScore] = useState({ A: initial.a, B: initial.b });
  const [goals, setGoals] = useState<Record<string, number>>(initial.scorers);

  // Un campo vacío (NaN mientras se escribe) cuenta como 0.
  const goalsOf = (t: "A" | "B") => (Number.isNaN(score[t]) ? 0 : score[t]);
  const sumFor = (t: "A" | "B") => players.filter((p) => p.team === t).reduce((s, p) => s + (goals[p.user_id] ?? 0), 0);
  const over = (["A", "B"] as const).filter((t) => sumFor(t) > goalsOf(t));

  const scorers = JSON.stringify(
    Object.entries(goals)
      .filter(([, g]) => g > 0)
      .map(([user_id, g]) => ({ user_id, goals: g })),
  );

  return (
    <form
      action={action}
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        const msg = `¿Guardar el resultado ${goalsOf("A")}–${goalsOf("B")}? Después no se puede cambiar el marcador, solo los goleadores.`;
        if (!locked && !window.confirm(msg)) e.preventDefault();
      }}
    >
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="team_a_goals" value={goalsOf("A")} />
      <input type="hidden" name="team_b_goals" value={goalsOf("B")} />
      <input type="hidden" name="scorers" value={scorers} />
      <Alert kind="error">{state.error}</Alert>

      <section aria-label="Marcador" className="grid grid-cols-2 gap-3">
        {(["A", "B"] as const).map((t) => (
          <div key={t} className={`flex flex-col items-center gap-2 rounded-2xl border p-3 ${TEAM[t].box}`}>
            <p className={`max-w-full truncate font-bold ${TEAM[t].title}`}>{teamLabel(names, t)}</p>
            {locked ? (
              <span className="text-4xl font-bold tabular-nums">{score[t]}</span>
            ) : (
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                aria-label={`Goles de ${teamLabel(names, t)}`}
                value={Number.isNaN(score[t]) ? "" : score[t]}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const n = e.target.value === "" ? NaN : Math.min(99, Math.max(0, Math.trunc(Number(e.target.value))));
                  setScore((s) => ({ ...s, [t]: n }));
                }}
                className="h-16 w-24 rounded-xl border border-black/15 bg-white text-center text-4xl font-bold tabular-nums outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20 dark:border-white/15 dark:bg-white/5"
              />
            )}
          </div>
        ))}
      </section>
      {locked && <p className="-mt-3 text-xs opacity-70">🔒 El resultado ya está guardado y no se puede cambiar.</p>}

      {(["A", "B"] as const).map((t) => (
        <section key={t} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className={`font-semibold ${TEAM[t].title}`}>Goleadores de {teamLabel(names, t)}</h2>
            <span className={`text-sm tabular-nums ${over.includes(t) ? "font-bold text-red-600" : "opacity-60"}`}>
              {sumFor(t)}/{goalsOf(t)}
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-black/5 dark:divide-white/10">
            {players
              .filter((p) => p.team === t)
              .map((p) => (
                <li key={p.user_id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="truncate">
                    {(goals[p.user_id] ?? 0) > 0 && "⚽ "}
                    {p.display_name}
                  </span>
                  <Stepper
                    label={p.display_name}
                    value={goals[p.user_id] ?? 0}
                    onChange={(n) => setGoals((g) => ({ ...g, [p.user_id]: n }))}
                  />
                </li>
              ))}
          </ul>
        </section>
      ))}

      {over.length > 0 ? (
        <Alert kind="error">
          Los goleadores de {over.map((t) => teamLabel(names, t)).join(" y ")} suman más goles que el resultado.
        </Alert>
      ) : (
        <p className="text-xs opacity-60">
          Los goleadores pueden sumar menos que el resultado (por ejemplo, goles en contra), pero nunca más.
        </p>
      )}

      <SubmitButton disabled={over.length > 0} pendingText="Guardando…">
        {locked ? "Guardar goleadores" : "Guardar resultado"}
      </SubmitButton>
    </form>
  );
}
