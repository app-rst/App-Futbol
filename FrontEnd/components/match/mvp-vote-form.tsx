"use client";

import { useActionState, useState } from "react";
import { castVote } from "@/app/actions/results";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";

type Candidate = { user_id: string; display_name: string; team: "A" | "B" | null };

export function MvpVoteForm({ matchId, candidates }: { matchId: string; candidates: Candidate[] }) {
  const [state, action] = useActionState(castVote, {});
  const [selected, setSelected] = useState("");
  const chosen = candidates.find((c) => c.user_id === selected);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (chosen && !window.confirm(`¿Votar a ${chosen.display_name} para el Premio Lio Messi? No se puede cambiar.`)) e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="match_id" value={matchId} />
      <Alert kind="error">{state.error}</Alert>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">Elegí al ganador del Premio Lio Messi</legend>
        {candidates.map((c) => (
          <label
            key={c.user_id}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-black/10 bg-white p-2.5 text-sm has-[:checked]:border-amber-500 has-[:checked]:bg-amber-400/15 dark:border-white/10 dark:bg-white/5"
          >
            <input
              type="radio"
              name="candidate"
              value={c.user_id}
              checked={selected === c.user_id}
              onChange={() => setSelected(c.user_id)}
              className="accent-amber-500"
            />
            <span className="truncate font-medium">{c.display_name}</span>
            {c.team && (
              <span className={`ml-auto text-xs font-bold ${c.team === "A" ? "text-sky-600" : "text-orange-500"}`}>
                {c.team}
              </span>
            )}
          </label>
        ))}
      </fieldset>
      <SubmitButton variant="gold" disabled={!chosen} pendingText="Votando…">
        🏆 Votar
      </SubmitButton>
    </form>
  );
}
