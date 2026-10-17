import Link from "next/link";
import { redirect } from "next/navigation";
import { getMatchView } from "@/lib/matches";
import { TeamPicker } from "./team-picker";

export const metadata = { title: "Armar equipos" };

export default async function TeamsPage({ params }: PageProps<"/partidos/[id]/equipos">) {
  const { id } = await params;
  const { match, viewer, roster } = await getMatchView({ id });
  // Solo el admin, con el partido vigente y sin resultado (la base lo vuelve a validar).
  if (!viewer.is_admin || match.status === "cancelled" || match.result_loaded_at) redirect(`/partidos/${id}`);

  const starters = roster.filter((p) => p.is_starter);

  return (
    <>
      <header>
        <Link href={`/partidos/${id}`} className="text-sm opacity-60">
          ← Volver al partido
        </Link>
        <h1 className="text-2xl font-bold">Armar equipos</h1>
        <p className="text-sm opacity-70">Tocá A o B en cada titular. Tocá de nuevo para dejarlo sin equipo.</p>
      </header>
      {starters.length === 0 ? (
        <p className="text-sm opacity-70">Todavía no hay titulares.</p>
      ) : (
        <TeamPicker matchId={id} starters={starters} />
      )}
    </>
  );
}
