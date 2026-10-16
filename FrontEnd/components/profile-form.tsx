"use client";

import { useActionState } from "react";
import { saveProfile } from "@/app/actions/profile";
import { ProfileFields } from "@/components/profile-fields";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";
import type { FormState } from "@/lib/validators";

type Values = Partial<Record<"first_name" | "last_name" | "nickname" | "phone", string>>;

export function ProfileForm({
  initial,
  next,
  submitLabel = "Guardar",
}: {
  initial: Values;
  /** Si viene, después de guardar redirige ahí (onboarding). */
  next?: string;
  submitLabel?: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveProfile, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <Alert kind="error">{state.error}</Alert>
      <Alert kind="success">{state.success}</Alert>
      <ProfileFields values={state.values ?? initial} errors={state.fieldErrors ?? {}} />
      <SubmitButton pendingText="Guardando…">{submitLabel}</SubmitButton>
    </form>
  );
}
