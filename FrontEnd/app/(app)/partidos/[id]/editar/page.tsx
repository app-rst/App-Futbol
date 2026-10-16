import Link from "next/link";
import { redirect } from "next/navigation";
import { updateMatch } from "@/app/actions/matches";
import { MatchForm } from "@/components/match-form";
import { matchPhase, utcToLocalParts } from "@/lib/dates";
import { getMatchView } from "@/lib/matches";

export const metadata = { title: "Editar partido" };

export default async function EditMatchPage({ params }: PageProps<"/partidos/[id]/editar">) {
  const { id } = await params;
  const { match, viewer } = await getMatchView({ id });
  // Solo el admin y antes del inicio (la base lo vuelve a validar).
  if (!viewer.is_admin || matchPhase(match) !== "upcoming") redirect(`/partidos/${id}`);

  const s = utcToLocalParts(match.starts_at);
  const e = utcToLocalParts(match.ends_at);
  const d = utcToLocalParts(match.signup_deadline);

  return (
    <>
      <header>
        <Link href={`/partidos/${id}`} className="text-sm opacity-60">
          ← Volver al partido
        </Link>
        <h1 className="text-2xl font-bold">Editar partido</h1>
        <p className="text-sm opacity-70">
          Si bajás la cantidad de titulares, los últimos inscriptos pasan a ser suplentes. Si la subís, entran suplentes.
        </p>
      </header>
      <MatchForm
        action={updateMatch}
        hidden={{ match_id: id }}
        initial={{
          location: match.location,
          date: s.date,
          start_time: s.time,
          end_time: e.time,
          starters_count: String(match.starters_count),
          field_cost: String(Number(match.field_cost)),
          deadline_date: d.date,
          deadline_time: d.time,
        }}
        submitLabel="Guardar cambios"
        pendingText="Guardando…"
      />
    </>
  );
}
