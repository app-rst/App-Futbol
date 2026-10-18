import Link from "next/link";
import { createMatch } from "@/app/actions/matches";
import { MatchForm, type MatchFormValues, type MatchTemplate } from "@/components/match-form";
import { utcToLocalParts } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Crear partido" };

const WEEK_MS = 7 * 24 * 3600 * 1000;

const EMPTY: MatchFormValues = {
  location: "",
  date: "",
  start_time: "",
  end_time: "",
  starters_count: "10",
  field_cost: "",
  deadline_date: "",
  deadline_time: "",
};

type Template = {
  location: string;
  starts_at: string;
  ends_at: string;
  starters_count: number;
  field_cost: number;
  signup_deadline: string;
};

/**
 * Se copian todos los datos del partido anterior. Las fechas se corren de a una semana
 * hasta que queden en el futuro (mismo día y horario), conservando la
 * anticipación del límite de inscripción.
 */
function fromTemplate(t: Template): MatchFormValues {
  const start = new Date(t.starts_at).getTime();
  const weeks = Math.max(1, Math.ceil((Date.now() - start) / WEEK_MS));
  const shift = start > Date.now() ? WEEK_MS : weeks * WEEK_MS;
  const s = utcToLocalParts(new Date(start + shift));
  const e = utcToLocalParts(new Date(new Date(t.ends_at).getTime() + shift));
  const d = utcToLocalParts(new Date(new Date(t.signup_deadline).getTime() + shift));
  return {
    location: t.location,
    date: s.date,
    start_time: s.time,
    end_time: e.time,
    starters_count: String(t.starters_count),
    field_cost: String(Number(t.field_cost)),
    deadline_date: d.date,
    deadline_time: d.time,
  };
}

/** Hasta cuántos lugares distintos se sugieren. */
const MAX_TEMPLATES = 20;

/** Tu último partido organizado en cada lugar, para autocompletar al escribirlo. */
async function loadTemplates(): Promise<MatchTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_matches");
  const latest = new Map<string, string>();
  for (const m of ((data ?? []) as { id: string; location: string; starts_at: string; is_admin: boolean }[])
    .filter((m) => m.is_admin)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))) {
    const key = m.location.trim().toLowerCase();
    if (!latest.has(key) && latest.size < MAX_TEMPLATES) latest.set(key, m.id);
  }

  const templates = await Promise.all(
    [...latest.values()].map(async (id) => {
      const { data: t } = await supabase.rpc("get_match_template", { p_match_id: id }).maybeSingle<Template>();
      return t ? { id, values: fromTemplate(t) } : null;
    }),
  );
  return templates.filter((t) => t !== null);
}

export default async function NewMatchPage() {
  const templates = await loadTemplates();

  return (
    <>
      <header>
        <Link href="/" className="text-sm opacity-60">
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold">Crear partido</h1>
        <p className="text-sm opacity-70">Vas a quedar como admin y anotado como titular.</p>
      </header>
      <MatchForm
        action={createMatch}
        initial={EMPTY}
        templates={templates}
        submitLabel="Crear partido"
        pendingText="Creando…"
      />
    </>
  );
}
