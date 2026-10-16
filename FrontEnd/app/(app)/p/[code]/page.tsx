import { redirect } from "next/navigation";
import { joinMatch } from "@/app/actions/enrollment";
import { ConfirmAction } from "@/components/ui/confirm-action";
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
          <ConfirmAction
            action={joinMatch}
            fields={{ invite_code: code }}
            label={full ? "Anotarme como suplente" : "Anotarme"}
            pendingText="Anotándote…"
            variant="primary"
          />
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
