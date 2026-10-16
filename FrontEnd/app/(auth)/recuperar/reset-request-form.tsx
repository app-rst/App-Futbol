"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, {});
  if (state.success) return <Alert kind="success">{state.success}</Alert>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Alert kind="error">{state.error}</Alert>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingText="Enviando…">Enviar link</SubmitButton>
    </form>
  );
}
