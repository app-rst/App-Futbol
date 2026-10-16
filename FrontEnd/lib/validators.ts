import { z } from "zod";
import { parseARS } from "@/lib/cost";
import { localToUtc, matchTimesFromForm } from "@/lib/dates";
import { normalizeArPhone } from "@/lib/phone";

const name = (label: string) =>
  z
    .string({ error: `Ingresá tu ${label}` })
    .trim()
    .min(1, { error: `Ingresá tu ${label}` })
    .max(50, { error: "Máximo 50 caracteres" });

export const phoneSchema = z
  .string({ error: "Ingresá tu celular" })
  .trim()
  .min(1, { error: "Ingresá tu celular" })
  .transform((v, ctx) => {
    const normalized = normalizeArPhone(v);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Celular inválido. Ej: 11 1234-5678" });
      return z.NEVER;
    }
    return normalized;
  });

export const profileSchema = z.object({
  first_name: name("nombre"),
  last_name: name("apellido"),
  nickname: z
    .string()
    .trim()
    .max(30, { error: "Máximo 30 caracteres" })
    .transform((v) => (v === "" ? null : v)),
  phone: phoneSchema,
});

const password = z.string().min(8, { error: "La contraseña debe tener al menos 8 caracteres" });

export const signUpSchema = profileSchema
  .extend({
    email: z.email({ error: "Email inválido" }),
    password,
    password_confirm: z.string(),
  })
  .refine((d) => d.password === d.password_confirm, {
    error: "Las contraseñas no coinciden",
    path: ["password_confirm"],
  });

export const loginSchema = z.object({
  email: z.email({ error: "Email inválido" }),
  password: z.string().min(1, { error: "Ingresá tu contraseña" }),
});

export const emailSchema = z.object({ email: z.email({ error: "Email inválido" }) });

export const newPasswordSchema = z
  .object({ password, password_confirm: z.string() })
  .refine((d) => d.password === d.password_confirm, {
    error: "Las contraseñas no coinciden",
    path: ["password_confirm"],
  });

const required = (msg: string) => z.string({ error: msg }).trim().min(1, { error: msg });

/**
 * Formulario de partido (fechas y horas en hora de Argentina). Devuelve los
 * datos listos para las RPC create_match / update_match (instantes en UTC).
 * Las reglas de negocio se vuelven a validar en la base.
 */
export const matchFormSchema = z
  .object({
    location: required("Ingresá el lugar").pipe(z.string().max(120, { error: "Máximo 120 caracteres" })),
    date: required("Elegí la fecha"),
    start_time: required("Elegí la hora de inicio"),
    end_time: required("Elegí la hora de fin"),
    starters_count: z.coerce
      .number({ error: "Ingresá un número" })
      .int({ error: "Tiene que ser un número entero" })
      .min(10, { error: "Mínimo 10 titulares" })
      .max(40, { error: "Máximo 40 titulares" }),
    field_cost: z.string().transform((v, ctx) => {
      const n = parseARS(v);
      if (n === null) {
        ctx.addIssue({ code: "custom", message: "Ingresá un monto válido. Ej: 50000" });
        return z.NEVER;
      }
      return n;
    }),
    deadline_date: required("Elegí la fecha límite"),
    deadline_time: required("Elegí la hora límite"),
  })
  .transform((d, ctx) => {
    const times = matchTimesFromForm(d.date, d.start_time, d.end_time);
    const deadline = localToUtc(d.deadline_date, d.deadline_time);
    if (!times) {
      ctx.addIssue({ code: "custom", message: "Fecha u horario inválido", path: ["date"] });
      return z.NEVER;
    }
    if (!deadline) {
      ctx.addIssue({ code: "custom", message: "Fecha límite inválida", path: ["deadline_date"] });
      return z.NEVER;
    }
    if (times.startsAt.getTime() <= Date.now()) {
      ctx.addIssue({ code: "custom", message: "El partido tiene que ser en el futuro", path: ["date"] });
      return z.NEVER;
    }
    if (deadline.getTime() > times.startsAt.getTime()) {
      ctx.addIssue({ code: "custom", message: "Tiene que ser antes del inicio del partido", path: ["deadline_date"] });
      return z.NEVER;
    }
    return {
      p_location: d.location,
      p_starts_at: times.startsAt.toISOString(),
      p_ends_at: times.endsAt.toISOString(),
      p_starters_count: d.starters_count,
      p_field_cost: d.field_cost,
      p_signup_deadline: deadline.toISOString(),
    };
  });

export type FieldErrors = Record<string, string[] | undefined>;

/** Estado que devuelven las Server Actions de formularios. */
export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
};

/** Valores enviados (sin contraseñas) para volver a mostrarlos si hay error. */
export function formValues(formData: FormData, omit: string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string" && !omit.includes(k) && !k.startsWith("$")) out[k] = v;
  }
  return out;
}

export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}
