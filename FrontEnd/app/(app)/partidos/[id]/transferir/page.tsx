import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { matchPhase } from "@/lib/dates";
import { getMatchView } from "@/lib/matches";
import { TransferForm } from "./transfer-form";

export const metadata = { title: "Pasar el admin" };

/** El admin solo puede bajarse eligiendo antes a otro titular como nuevo admin. */
export default async function TransferPage({ params }: PageProps<"/partidos/[id]/transferir">) {
  const { id } = await params;
  const { match, viewer, roster } = await getMatchView({ id });
  if (!viewer.is_admin || matchPhase(match) !== "upcoming") redirect(`/partidos/${id}`);

  const candidates = roster.filter((p) => p.is_starter && !p.is_me);

  return (
    <>
      <header>
        <Link href={`/partidos/${id}`} className="text-sm opacity-60">
          ← Volver al partido
        </Link>
        <h1 className="text-2xl font-bold">Bajarme del partido</h1>
        <p className="text-sm opacity-70">
          Como sos el admin, antes de bajarte tenés que elegir a otro <strong>titular</strong> como nuevo admin. Va a
          poder editar el partido, armar equipos, sacar jugadores, cancelarlo y ver los celulares.
        </p>
      </header>

      {candidates.length === 0 ? (
        <Alert kind="info">
          No hay otro titular a quien pasarle el admin.{" "}
          {viewer.can_cancel
            ? "Si no vas a jugar, podés cancelar el partido desde la pantalla del partido."
            : "Esperá a que se anote alguien más."}
        </Alert>
      ) : (
        <TransferForm
          matchId={id}
          candidates={candidates.map(({ user_id, display_name, position }) => ({ user_id, display_name, position }))}
        />
      )}
    </>
  );
}
