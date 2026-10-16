"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Alert kind="error">{state.error}</Alert>
      <Field
        label="Contraseña nueva"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        error={state.fieldErrors?.password}
        hint="Mínimo 8 caracteres."
      />
      <Field
        label="Repetila"
        name="password_confirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.password_confirm}
      />
      <SubmitButton pendingText="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  );
}
