"use client";

import { useActionState, useState } from "react";
import { transferAdminAndLeave } from "@/app/actions/admin-tools";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";

type Candidate = { user_id: string; display_name: string; position: number };

export function TransferForm({ matchId, candidates }: { matchId: string; candidates: Candidate[] }) {
  const [state, action] = useActionState(transferAdminAndLeave, {});
  const [selected, setSelected] = useState<string>("");
  const chosen = candidates.find((c) => c.user_id === selected);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!chosen) return;
        const ok = window.confirm(
          `¿Pasarle el admin a ${chosen.display_name} y bajarte del partido? No se puede deshacer.`,
        );
        if (!ok) e.preventDefault();
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="match_id" value={matchId} />
      <Alert kind="error">{state.error}</Alert>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">¿Quién queda como admin?</legend>
        {candidates.map((c) => (
          <label
            key={c.user_id}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/10 bg-white p-3 has-[:checked]:border-green-700 has-[:checked]:bg-green-700/5 dark:border-white/10 dark:bg-white/5"
          >
            <input
              type="radio"
              name="new_admin"
              value={c.user_id}
              checked={selected === c.user_id}
              onChange={() => setSelected(c.user_id)}
              className="size-5 accent-green-700"
            />
            <span className="w-5 text-right text-sm tabular-nums opacity-50">{c.position}</span>
            <span className="font-medium">{c.display_name}</span>
          </label>
        ))}
      </fieldset>

      <SubmitButton variant="danger" disabled={!chosen} pendingText="Pasando el admin…">
        Pasar el admin y bajarme
      </SubmitButton>
    </form>
  );
}
