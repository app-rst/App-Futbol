import { formatArPhone, whatsappLink } from "@/lib/phone";
import type { RosterEntry } from "@/lib/types";

function PlayerRow({ p, label }: { p: RosterEntry; label: string }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="w-6 shrink-0 text-right text-sm tabular-nums opacity-50">{label}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {p.display_name}
          {p.is_me && <span className="ml-1 text-xs font-normal opacity-60">(vos)</span>}
        </p>
        {p.phone && (
          <a
            href={whatsappLink(p.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline underline-offset-2 opacity-70"
          >
            {formatArPhone(p.phone)}
          </a>
        )}
      </div>
      {p.is_admin && (
        <span className="rounded-full bg-green-700/10 px-2 py-0.5 text-xs font-semibold text-green-800 dark:text-green-300">
          Admin
        </span>
      )}
    </li>
  );
}

/**
 * Titulares (X/N) y suplentes. La lista de suplentes solo aparece cuando los
 * titulares están completos (antes no puede haber suplentes).
 */
export function Roster({ roster, startersCount }: { roster: RosterEntry[]; startersCount: number }) {
  const starters = roster.filter((p) => p.is_starter);
  const subs = roster.filter((p) => !p.is_starter);
  const free = Math.max(startersCount - starters.length, 0);
  const pct = Math.min(100, Math.round((starters.length / startersCount) * 100));

  return (
    <section className="flex flex-col gap-4">
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="font-semibold">Titulares</h2>
          <span className="text-sm tabular-nums">
            <strong>{starters.length}</strong>/{startersCount}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10" aria-hidden>
          <div className="h-full rounded-full bg-green-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs opacity-60">
          {free > 0 ? `${free} lugar${free === 1 ? "" : "es"} libre${free === 1 ? "" : "s"}` : "¡Lista completa!"}
        </p>
        <ol className="mt-2 divide-y divide-black/5 dark:divide-white/10">
          {starters.map((p) => (
            <PlayerRow key={p.user_id} p={p} label={String(p.position)} />
          ))}
        </ol>
      </div>

      {subs.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Suplentes</h2>
            <span className="text-sm tabular-nums">{subs.length}</span>
          </div>
          <p className="text-xs opacity-60">Si un titular se baja, entra el primero de esta lista.</p>
          <ol className="mt-2 divide-y divide-black/5 dark:divide-white/10">
            {subs.map((p, i) => (
              <PlayerRow key={p.user_id} p={p} label={`S${i + 1}`} />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
