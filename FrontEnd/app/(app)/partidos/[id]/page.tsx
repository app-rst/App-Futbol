import Link from "next/link";
import { leaveMatch } from "@/app/actions/enrollment";
import { MatchSummary } from "@/components/match/match-summary";
import { Roster } from "@/components/match/roster";
import { ShareButton } from "@/components/share-button";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button-styles";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { matchPhase } from "@/lib/dates";
import { getMatchView, shareText } from "@/lib/matches";
import type { MatchView } from "@/lib/types";

export const metadata = { title: "Partido" };

/** Tu lugar en la lista: titular o suplente (con cuántos tenés adelante). */
function MyStatus({ view, canLeave }: { view: MatchView; canLeave: boolean }) {
  const { viewer, match } = view;
  if (viewer.position === null) return null;
  const subNumber = viewer.position - match.starters_count;

  return (
    <section
      className={`flex flex-col gap-3 rounded-2xl border p-4 ${
        viewer.is_starter
          ? "border-green-700/30 bg-green-700/5"
          : "border-amber-500/40 bg-amber-500/10"
      }`}
    >
      <div>
        <p className="text-xs uppercase tracking-wide opacity-60">Tu lugar</p>
        <p className="text-lg font-bold">
          {viewer.is_starter ? `Titular · #${viewer.position}` : `Suplente #${subNumber}`}
        </p>
        {!viewer.is_starter && (
          <p className="text-sm opacity-80">
            {subNumber === 1
              ? "Sos el primero en la fila: si un titular se baja, entrás vos."
              : `Tenés ${subNumber - 1} suplente${subNumber - 1 === 1 ? "" : "s"} adelante.`}
          </p>
        )}
      </div>
      {canLeave &&
        (viewer.is_admin ? (
          <p className="text-xs opacity-70">
            Sos el admin: para bajarte primero vas a tener que elegir a otro titular como admin (próxima etapa).
          </p>
        ) : (
          <ConfirmAction
            action={leaveMatch}
            fields={{ match_id: match.id }}
            confirm={
              viewer.is_starter
                ? "¿Seguro que te querés bajar? Si hay suplentes, entra el primero en tu lugar."
                : "¿Seguro que te querés bajar de la lista de suplentes?"
            }
            label="Bajarme del partido"
            pendingText="Bajándote…"
            variant="secondary"
            className="w-full text-red-600 dark:text-red-400"
          />
        ))}
    </section>
  );
}

export default async function MatchPage({ params, searchParams }: PageProps<"/partidos/[id]">) {
  const { id } = await params;
  const { creado, anotado } = await searchParams;
  const view = await getMatchView({ id });
  const { match, viewer } = view;
  const phase = matchPhase(match);
  const isUpcoming = phase === "upcoming";
  // Sacar jugadores: admin del partido o admin del sistema, antes del inicio.
  const canRemove = isUpcoming && (viewer.is_admin || viewer.is_system_admin);

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
      {anotado && viewer.position !== null && (
        <Alert kind="success">
          {viewer.is_starter
            ? "¡Listo! Quedaste anotado como titular. ⚽"
            : "¡Listo! Quedaste en la lista de suplentes: si alguien se baja, entrás."}
        </Alert>
      )}

      <MatchSummary match={match} />

      <MyStatus view={view} canLeave={isUpcoming} />

      {isUpcoming && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold opacity-70">Invitá a los pibes</h2>
          <ShareButton inviteCode={match.invite_code} text={shareText(match)} />
        </section>
      )}

      <Roster
        roster={view.roster}
        startersCount={match.starters_count}
        removeFromMatchId={canRemove ? match.id : null}
      />

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
