/** Esqueleto liviano mientras carga una pantalla de la app. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="flex animate-pulse flex-col gap-4">
      <div className="h-4 w-24 rounded bg-black/10 dark:bg-white/10" />
      <div className="h-8 w-2/3 rounded bg-black/10 dark:bg-white/10" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-20 rounded-xl bg-black/10 dark:bg-white/10" />
        <div className="h-20 rounded-xl bg-black/10 dark:bg-white/10" />
      </div>
      <div className="h-24 rounded-2xl bg-black/10 dark:bg-white/10" />
      <div className="h-24 rounded-2xl bg-black/10 dark:bg-white/10" />
    </div>
  );
}
