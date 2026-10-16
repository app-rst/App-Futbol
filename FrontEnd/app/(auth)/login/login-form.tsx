"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
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
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
    </form>
  );
}
