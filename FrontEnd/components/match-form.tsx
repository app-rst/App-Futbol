"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { costPerPlayer, formatARS, parseARS } from "@/lib/cost";
import { shiftLocal } from "@/lib/dates";
import type { FormState } from "@/lib/validators";

export type MatchFormValues = {
  location: string;
  date: string;
  start_time: string;
  end_time: string;
  starters_count: string;
  field_cost: string;
  deadline_date: string;
  deadline_time: string;
};

/** Por defecto, el límite de inscripción es 2 horas antes del inicio. */
const DEFAULT_DEADLINE_MINUTES = -120;

export function MatchForm({
  action,
  initial,
  hidden = {},
  submitLabel,
  pendingText,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: MatchFormValues;
  hidden?: Record<string, string>;
  submitLabel: string;
  pendingText: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [v, setV] = useState(initial);
  // Mientras el usuario no toque el límite, se recalcula solo al cambiar fecha/hora.
  const [deadlineTouched, setDeadlineTouched] = useState(Boolean(initial.deadline_date));
  const e = state.fieldErrors ?? {};

  function update<K extends keyof MatchFormValues>(key: K, value: string) {
    setV((prev) => {
      const next = { ...prev, [key]: value };
      if (!deadlineTouched && (key === "date" || key === "start_time") && next.date && next.start_time) {
        const d = shiftLocal(next.date, next.start_time, DEFAULT_DEADLINE_MINUTES);
        if (d) {
          next.deadline_date = d.date;
          next.deadline_time = d.time;
        }
      }
      return next;
    });
  }

  const cost = parseARS(v.field_cost);
  const perPlayer = cost !== null ? costPerPlayer(cost, Number(v.starters_count)) : null;
  const endsNextDay = Boolean(v.start_time && v.end_time && v.end_time <= v.start_time);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Alert kind="error">{state.error}</Alert>

      <Field
        label="Lugar"
        name="location"
        required
        maxLength={120}
        placeholder="Ej: Complejo La Bombonera, cancha 3"
        value={v.location}
        onChange={(ev) => update("location", ev.target.value)}
        error={e.location}
      />

      <Field
        label="Fecha"
        name="date"
        type="date"
        required
        value={v.date}
        onChange={(ev) => update("date", ev.target.value)}
        error={e.date}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Hora de inicio"
          name="start_time"
          type="time"
          required
          value={v.start_time}
          onChange={(ev) => update("start_time", ev.target.value)}
          error={e.start_time}
        />
        <Field
          label="Hora de fin"
          name="end_time"
          type="time"
          required
          value={v.end_time}
          onChange={(ev) => update("end_time", ev.target.value)}
          error={e.end_time}
          hint={endsNextDay ? "Termina al día siguiente." : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Titulares"
          name="starters_count"
          type="number"
          inputMode="numeric"
          min={10}
          max={40}
          required
          value={v.starters_count}
          onChange={(ev) => update("starters_count", ev.target.value)}
          error={e.starters_count}
          hint="Mínimo 10."
        />
        <Field
          label="Costo de la cancha"
          name="field_cost"
          inputMode="decimal"
          required
          placeholder="50000"
          value={v.field_cost}
          onChange={(ev) => update("field_cost", ev.target.value)}
          error={e.field_cost}
          hint="Total, en pesos."
        />
      </div>

      <div className="rounded-xl bg-green-700/10 px-4 py-3 text-green-900 dark:text-green-200">
        <p className="text-xs uppercase tracking-wide opacity-70">Costo por jugador</p>
        <p className="text-2xl font-bold">{perPlayer !== null ? formatARS(perPlayer) : "—"}</p>
        <p className="text-xs opacity-70">Cancha ÷ titulares, redondeado hacia arriba. Solo informativo.</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Límite de inscripción</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Fecha"
            name="deadline_date"
            type="date"
            required
            value={v.deadline_date}
            onChange={(ev) => {
              setDeadlineTouched(true);
              update("deadline_date", ev.target.value);
            }}
            error={e.deadline_date}
          />
          <Field
            label="Hora"
            name="deadline_time"
            type="time"
            required
            value={v.deadline_time}
            onChange={(ev) => {
              setDeadlineTouched(true);
              update("deadline_time", ev.target.value);
            }}
            error={e.deadline_time}
          />
        </div>
        <p className="text-xs opacity-60">Es informativo: después de esa hora la gente se puede seguir anotando.</p>
      </fieldset>

      <SubmitButton pendingText={pendingText}>{submitLabel}</SubmitButton>
    </form>
  );
}
