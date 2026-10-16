"use client";

import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";
import { ProfileFields } from "@/components/profile-fields";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUp, {});

  if (state.success) {
    return (
      <Alert kind="success">
        <p className="font-semibold">¡Ya casi! 📬</p>
        <p>{state.success}</p>
      </Alert>
    );
  }

  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Alert kind="error">{state.error}</Alert>
      <ProfileFields values={v} errors={e} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={v.email}
        error={e.email}
        hint="No lo ven los demás jugadores."
      />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        error={e.password}
        hint="Mínimo 8 caracteres."
      />
      <Field
        label="Repetí la contraseña"
        name="password_confirm"
        type="password"
        autoComplete="new-password"
        required
        error={e.password_confirm}
      />
      <SubmitButton pendingText="Creando cuenta…">Crear cuenta</SubmitButton>
    </form>
  );
}
