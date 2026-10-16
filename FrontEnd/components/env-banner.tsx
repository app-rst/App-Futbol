const LABELS: Record<string, string> = {
  development: "🧪 DESARROLLO · base de pruebas",
  preview: "🧪 PREVIEW · base de pruebas",
};

/** Franja visible fuera de producción para no confundir nunca en qué ambiente estás. */
export function EnvBanner() {
  const label = LABELS[process.env.NEXT_PUBLIC_APP_ENV ?? "production"];
  if (!label) return null;
  return (
    <div
      role="note"
      className="bg-amber-400 py-0.5 pt-[max(0.125rem,env(safe-area-inset-top))] text-center text-[11px] font-bold tracking-wide text-black"
    >
      {label}
    </div>
  );
}
