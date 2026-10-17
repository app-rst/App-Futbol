import Link from "next/link";
import { cancelMatch } from "@/app/actions/admin-tools";
import { leaveMatch } from "@/app/actions/enrollment";
import { MatchSummary } from "@/components/match/match-summary";
import { Roster } from "@/components/match/roster";
import { TeamsView } from "@/components/match/teams-view";
import { ShareButton } from "@/components/share-button";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button-styles";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { formatDateTime, matchPhase } from "@/lib/dates";
import { getMatchPost, getMatchView, shareText } from "@/lib/matches";
import { MvpSection, ResultCard } from "@/components/match/post-match";
import type { MatchView } from "@/lib/types";

export const metadata = { title: "Partido" };

/** Tu lugar en la lista: titular o suplente (con cuántos tenés adelante). */
function MyStatus({ view }: { view: MatchView }) {
  const { viewer, match } = view;
  if (viewer.position === null) return null;
  const subNumber = viewer.position - match.starters_count;

  return (
    <section
      className={`flex flex-col gap-3 rounded-2xl border p-4 ${
        viewer.is_starter ? "border-green-700/30 bg-green-700/5" : "border-amber-500/40 bg-amber-500/10"
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
    </section>
  );
}

/** Bajarse del partido: al final de la página, para no tocarlo sin querer. */
function LeaveSection({ view }: { view: MatchView }) {
  const { viewer, match } = view;
  if (viewer.position === null) return null;

  return (
    <section className="border-t border-black/10 pt-4 dark:border-white/10">
      {viewer.is_admin ? (
        <Link
          href={`/partidos/${match.id}/transferir`}
          className={buttonClass("secondary", "w-full text-red-600 dark:text-red-400")}
        >
          Bajarme (pasando el admin)
        </Link>
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
      )}
    </section>
  );
}

/** Cancelar: habilitado o deshabilitado según la regla de la base, con el motivo. */
function CancelSection({ view }: { view: MatchView }) {
  const { viewer, match } = view;
  const isModeration = viewer.is_system_admin && !viewer.is_admin;
  if (!viewer.is_admin && !isModeration) return null;
  if (match.status === "cancelled") return null;

  return (
    <div className="flex flex-col gap-1">
      {viewer.can_cancel ? (
        <ConfirmAction
          action={cancelMatch}
          fields={{ match_id: match.id }}
          confirm={
            isModeration
              ? "¿Cancelar este partido como administrador del sistema? Queda registrado."
              : "¿Cancelar el partido? Todos los anotados lo van a ver como cancelado. No se puede deshacer."
          }
          label={isModeration ? "🛡️ Cancelar (moderación)" : "Cancelar partido"}
          pendingText="Cancelando…"
          variant="danger"
        />
      ) : (
        <>
          <button type="button" disabled className={buttonClass("danger", "w-full")}>
            Cancelar partido
          </button>
          {viewer.cancel_block_reason && <p className="text-xs opacity-70">{viewer.cancel_block_reason}</p>}
        </>
      )}
    </div>
  );
}

export default async function MatchPage({ params, searchParams }: PageProps<"/partidos/[id]">) {
  const { id } = await params;
  const { creado, anotado, equipos, resultado, votado } = await searchParams;
  const view = await getMatchView({ id });
  const { match, viewer } = view;
  const phase = matchPhase(match);
  const isFinished = phase === "voting" || phase === "closed";
  // Resultado y MVP: desde que empieza (aviso de votación) hasta siempre.
  const post = phase === "playing" || isFinished ? await getMatchPost(id) : null;
  const isUpcoming = phase === "upcoming";
  const isCancelled = phase === "cancelled";
  // Sacar jugadores: admin del partido o admin del sistema, antes del inicio.
  const canRemove = isUpcoming && (viewer.is_admin || viewer.is_system_admin);
  const canEditTeams = viewer.is_admin && !isCancelled && !match.result_loaded_at;

  return (
    <>
      <Link href="/" className="text-sm opacity-60">
        ← Partidos
      </Link>

      {viewer.is_system_admin && !viewer.is_participant && (
        <Alert kind="info">🛡️ Estás viendo este partido como administrador del sistema.</Alert>
      )}
      {isCancelled && (
        <Alert kind="error">
          <strong>Partido cancelado</strong>
          {match.cancelled_at && ` el ${formatDateTime(match.cancelled_at)}`}.
        </Alert>
      )}
      {creado && isUpcoming && <Alert kind="success">¡Partido creado! Compartí el link para que se anoten.</Alert>}
      {anotado && viewer.position !== null && (
        <Alert kind="success">
          {viewer.is_starter
            ? "¡Listo! Quedaste anotado como titular. ⚽"
            : "¡Listo! Quedaste en la lista de suplentes: si alguien se baja, entrás."}
        </Alert>
      )}
      {equipos && <Alert kind="success">Equipos guardados.</Alert>}
      {resultado && <Alert kind="success">Resultado guardado.</Alert>}
      {votado && <Alert kind="success">¡Voto registrado! Es anónimo: nadie puede ver a quién votaste.</Alert>}

      <MatchSummary match={match} />

      {post && isFinished && <ResultCard post={post} matchId={match.id} isAdmin={viewer.is_admin} />}
      {post && <MvpSection post={post} matchId={match.id} />}

      <MyStatus view={view} />

      {isUpcoming && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold opacity-70">Invitá a los pibes</h2>
          <ShareButton inviteCode={match.invite_code} text={shareText(match)} />
        </section>
      )}

      <TeamsView roster={view.roster} />

      <Roster
        roster={view.roster}
        startersCount={match.starters_count}
        removeFromMatchId={canRemove ? match.id : null}
      />

      {(viewer.is_admin || viewer.can_duplicate || viewer.is_system_admin) && (
        <section className="flex flex-col gap-2 border-t border-black/10 pt-4 dark:border-white/10">
          <h2 className="text-sm font-semibold opacity-70">Opciones de admin</h2>
          <div className="grid grid-cols-2 gap-2">
            {canEditTeams && (
              <Link href={`/partidos/${match.id}/equipos`} className={buttonClass("secondary")}>
                👕 Equipos
              </Link>
            )}
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
          <CancelSection view={view} />
        </section>
      )}

      {isUpcoming && <LeaveSection view={view} />}
    </>
  );
}
