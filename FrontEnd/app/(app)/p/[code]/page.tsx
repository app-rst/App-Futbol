import { redirect } from "next/navigation";
import { MatchSummary } from "@/components/match/match-summary";
import { Roster } from "@/components/match/roster";
import { Alert } from "@/components/ui/alert";
import { matchPhase } from "@/lib/dates";
import { getMatchView } from "@/lib/matches";

export const metadata = { title: "Invitación a un partido" };

/** Landing del link de invitación que se comparte por WhatsApp. */
export default async function InvitePage({ params }: PageProps<"/p/[code]">) {
  const { code } = await params;
  const view = await getMatchView({ code });
  // Si ya estás en el partido, directo al detalle.
  if (view.viewer.is_participant) redirect(`/partidos/${view.match.id}`);

  const phase = matchPhase(view.match);
  const full = view.players_count >= view.match.starters_count;

  return (
    <>
      <p className="text-sm font-semibold text-green-800 dark:text-green-300">⚽ Te invitaron a un partido</p>
      <MatchSummary match={view.match} />

      {phase === "upcoming" ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-black/10 p-4 dark:border-white/10">
          <p className="text-sm">
            {full
              ? "La lista de titulares está completa: si te anotás, entrás como suplente."
              : "Todavía hay lugar entre los titulares."}
          </p>
          {/* La inscripción se habilita en la Etapa 3. */}
          <button type="button" disabled className="h-12 rounded-xl bg-green-700 font-semibold text-white opacity-50">
            Anotarme (próximamente)
          </button>
        </div>
      ) : (
        <Alert kind="info">
          {phase === "cancelled" ? "Este partido fue cancelado." : "Este partido ya empezó: no se puede anotar más gente."}
        </Alert>
      )}

      <Roster roster={view.roster} startersCount={view.match.starters_count} />
    </>
  );
}
