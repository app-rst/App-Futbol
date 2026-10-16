import { PHASE_LABEL, type MatchPhase } from "@/lib/dates";

const STYLES: Record<MatchPhase, string> = {
  upcoming: "bg-green-700/10 text-green-800 dark:text-green-300",
  playing: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  voting: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  closed: "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60",
  cancelled: "bg-red-600/10 text-red-700 dark:text-red-300",
};

export function PhaseBadge({ phase }: { phase: MatchPhase }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STYLES[phase]}`}>
      {PHASE_LABEL[phase]}
    </span>
  );
}
