import Link from "next/link";
import { MatchSummary } from "@/components/match/match-summary";
import { Roster } from "@/components/match/roster";
import { ShareButton } from "@/components/share-button";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button-styles";
import { matchPhase } from "@/lib/dates";
import { getMatchView, shareText } from "@/lib/matches";

export const metadata = { title: "Partido" };

export default async function MatchPage({ params, searchParams }: PageProps<"/partidos/[id]">) {
  const { id } = await params;
  const { creado } = await searchParams;
  const view = await getMatchView({ id });
  const { match, viewer } = view;
  const phase = matchPhase(match);
  const isUpcoming = phase === "upcoming";

  return (
    <>
      <Link href="/" className="text-sm opacity-60">
        ← Partidos
      </Link>

      {viewer.is_system_admin && !viewer.is_participant && (
        <Alert kind="info">🛡️ Estás viendo este partido como administrador del sistema.</Alert>
      )}
      {creado && isUpcoming && (
        <Alert kind="success">¡Partido creado! Compartí el link para que se anoten.</Alert>
      )}

      <MatchSummary match={match} />

      {isUpcoming && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold opacity-70">Invitá a los pibes</h2>
          <ShareButton inviteCode={match.invite_code} text={shareText(match)} />
        </section>
      )}

      <Roster roster={view.roster} startersCount={match.starters_count} />

      {(viewer.is_admin || viewer.can_duplicate) && (
        <section className="flex flex-col gap-2 border-t border-black/10 pt-4 dark:border-white/10">
          <h2 className="text-sm font-semibold opacity-70">Opciones de admin</h2>
          <div className="grid grid-cols-2 gap-2">
            {viewer.is_admin && isUpcoming && (
              <Link href={`/partidos/${match.id}/editar`} className={buttonClass("secondary")}>
                ✏️ Editar
              </Link>
            )}
            {viewer.can_duplicate && (
              <Link href={`/partidos/nuevo?duplicar=${match.id}`} className={buttonClass("secondary")}>
                📋 Duplicar
              </Link>
            )}
          </div>
        </section>
      )}
    </>
  );
}
