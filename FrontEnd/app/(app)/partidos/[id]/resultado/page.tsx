import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button-styles";
import { isPast } from "@/lib/dates";
import { getMatchPost, getMatchView } from "@/lib/matches";
import { teamNamesOf } from "@/lib/teams";
import { ResultForm } from "./result-form";

export const metadata = { title: "Resultado" };

export default async function ResultPage({ params }: PageProps<"/partidos/[id]/resultado">) {
  const { id } = await params;
  const { match, viewer, roster } = await getMatchView({ id });
  // Solo el admin, con el partido terminado y no cancelado (la base lo vuelve a validar).
  if (!viewer.is_admin || match.status === "cancelled" || !isPast(match.ends_at)) redirect(`/partidos/${id}`);

  const starters = roster.filter((p) => p.is_starter);
  const missingTeam = starters.filter((p) => !p.team);
  const post = await getMatchPost(id);

  return (
    <>
      <header>
        <Link href={`/partidos/${id}`} className="text-sm opacity-60">
          ← Volver al partido
        </Link>
        <h1 className="text-2xl font-bold">{post.result.loaded ? "Editar goleadores" : "Cargar resultado"}</h1>
        <p className="text-sm opacity-70">
          {post.result.loaded
            ? "El resultado quedó fijo; podés corregir quién hizo los goles."
            : "Goles de cada equipo y quiénes los hicieron."}
        </p>
      </header>

      {missingTeam.length > 0 ? (
        <div className="flex flex-col gap-3">
          <Alert kind="error">
            Antes de cargar el resultado, asigná a todos los titulares a un equipo. Faltan:{" "}
            {missingTeam.map((p) => p.display_name).join(", ")}.
          </Alert>
          <Link href={`/partidos/${id}/equipos`} className={buttonClass("primary")}>
            👕 Armar equipos
          </Link>
        </div>
      ) : (
        <ResultForm
          matchId={id}
          players={starters.map((p) => ({ user_id: p.user_id, display_name: p.display_name, team: p.team as "A" | "B" }))}
          initial={{
            a: post.result.team_a_goals ?? 0,
            b: post.result.team_b_goals ?? 0,
            scorers: Object.fromEntries(post.scorers.map((s) => [s.user_id, s.goals])),
          }}
          locked={post.result.loaded}
          names={teamNamesOf(match)}
        />
      )}
    </>
  );
}
