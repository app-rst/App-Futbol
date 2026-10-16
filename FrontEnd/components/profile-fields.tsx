import { Field } from "@/components/ui/field";
import type { FieldErrors } from "@/lib/validators";

/** Campos del perfil, compartidos por registro, onboarding y /perfil. */
export function ProfileFields({
  values,
  errors,
}: {
  values: Partial<Record<"first_name" | "last_name" | "nickname" | "phone", string>>;
  errors: FieldErrors;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Nombre"
          name="first_name"
          autoComplete="given-name"
          required
          maxLength={50}
          defaultValue={values.first_name}
          error={errors.first_name}
        />
        <Field
          label="Apellido"
          name="last_name"
          autoComplete="family-name"
          required
          maxLength={50}
          defaultValue={values.last_name}
          error={errors.last_name}
        />
      </div>
      <Field
        label="Apodo (opcional)"
        name="nickname"
        autoComplete="nickname"
        maxLength={30}
        defaultValue={values.nickname}
        error={errors.nickname}
        hint="Es como te ven los demás. Si no ponés apodo, se muestra tu nombre."
      />
      <Field
        label="Celular"
        name="phone"
        type="tel"
        autoComplete="tel-national"
        inputMode="tel"
        required
        placeholder="11 1234-5678"
        defaultValue={values.phone}
        error={errors.phone}
        hint="Código de área sin 0 y número sin 15. Solo lo ve el admin del partido."
      />
    </>
  );
}
