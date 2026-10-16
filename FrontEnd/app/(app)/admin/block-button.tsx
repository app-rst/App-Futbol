"use client";

import { useActionState } from "react";
import { setUserBlocked } from "@/app/actions/admin";
import { SubmitButton } from "@/components/ui/button";

export function BlockButton({ userId, name, blocked }: { userId: string; name: string; blocked: boolean }) {
  const [state, action] = useActionState(setUserBlocked, {});
  const nextBlocked = !blocked;
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const msg = nextBlocked
          ? `¿Bloquear a ${name}? No va a poder iniciar sesión ni usar la app.`
          : `¿Desbloquear a ${name}?`;
        if (!window.confirm(msg)) e.preventDefault();
      }}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="blocked" value={String(nextBlocked)} />
      <SubmitButton
        variant={nextBlocked ? "danger" : "secondary"}
        className="h-10 w-full text-sm"
        pendingText={nextBlocked ? "Bloqueando…" : "Desbloqueando…"}
      >
        {nextBlocked ? "Bloquear" : "Desbloquear"}
      </SubmitButton>
      {state.error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
