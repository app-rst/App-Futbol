"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/button";
import type { ButtonVariant } from "@/components/ui/button-styles";

type ActionState = { error?: string };

/**
 * Botón que ejecuta una Server Action (opcionalmente pidiendo confirmación) y
 * muestra el error que devuelva.
 */
export function ConfirmAction({
  action,
  fields,
  confirm,
  label,
  pendingText,
  variant = "secondary",
  className = "w-full",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  confirm?: string;
  label: React.ReactNode;
  pendingText: string;
  variant?: ButtonVariant;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="flex flex-col gap-1"
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={variant} className={className} pendingText={pendingText}>
        {label}
      </SubmitButton>
      {state.error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
