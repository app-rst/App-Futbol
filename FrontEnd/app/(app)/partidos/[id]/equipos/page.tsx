import Link from "next/link";
import { redirect } from "next/navigation";
import { getMatchView } from "@/lib/matches";
import { teamNamesOf } from "@/lib/teams";
import { TeamPicker } from "./team-picker";

export const metadata = { title: "Armar equipos" };

export default async function TeamsPage({ params }: PageProps<"/partidos/[id]/equipos">) {
  const { id } = await params;
  const { match, viewer, roster } = await getMatchView({ id });
  // Solo el admin, con el partido vigente (la base lo vuelve a validar). Con el
  // resultado cargado ya no se cambian los equipos, solo sus nombres.
  if (!viewer.is_admin || match.status === "cancelled") redirect(`/partidos/${id}`);
  const namesOnly = Boolean(match.result_loaded_at);

  const starters = roster.filter((p) => p.is_starter);

  return (
    <>
      <header>
        <Link href={`/partidos/${id}`} className="text-sm opacity-60">
          ← Volver al partido
        </Link>
        <h1 className="text-2xl font-bold">{namesOnly ? "Nombres de equipos" : "Armar equipos"}</h1>
        <p className="text-sm opacity-70">
          {namesOnly
            ? "El resultado ya está cargado: los equipos no cambian, pero podés ponerles nombre."
            : "Ponele nombre a cada equipo si querés, y tocá A o B en cada titular. Tocá de nuevo para dejarlo sin equipo."}
        </p>
      </header>
      {starters.length === 0 && !namesOnly ? (
        <p className="text-sm opacity-70">Todavía no hay titulares.</p>
      ) : (
        <TeamPicker matchId={id} starters={starters} names={teamNamesOf(match)} namesOnly={namesOnly} />
      )}
    </>
  );
}
