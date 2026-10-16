import Link from "next/link";
import { createMatch } from "@/app/actions/matches";
import { MatchForm, type MatchFormValues } from "@/components/match-form";
import { Alert } from "@/components/ui/alert";
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
 * Al duplicar se copian todos los datos. Las fechas se corren de a una semana
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

export default async function NewMatchPage({ searchParams }: PageProps<"/partidos/nuevo">) {
  const { duplicar } = await searchParams;
  const duplicateId = typeof duplicar === "string" ? duplicar : null;

  let initial = EMPTY;
  let duplicateError = false;
  if (duplicateId) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_match_template", { p_match_id: duplicateId }).maybeSingle<Template>();
    if (data) initial = fromTemplate(data);
    else duplicateError = true;
  }
  const duplicating = duplicateId && !duplicateError;

  return (
    <>
      <header>
        <Link href="/" className="text-sm opacity-60">
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold">{duplicating ? "Duplicar partido" : "Crear partido"}</h1>
        <p className="text-sm opacity-70">
          {duplicating
            ? "Copiamos los datos del partido anterior. Revisalos antes de guardar: la lista de jugadores arranca vacía."
            : "Vas a quedar como admin y anotado como titular."}
        </p>
      </header>
      {duplicateError && <Alert kind="error">No encontramos el partido para duplicar. Completá los datos a mano.</Alert>}
      <MatchForm
        action={createMatch}
        initial={initial}
        hidden={duplicating ? { duplicated_from: duplicateId } : {}}
        submitLabel="Crear partido"
        pendingText="Creando…"
      />
    </>
  );
}
