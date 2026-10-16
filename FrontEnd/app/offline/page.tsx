export const metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-5xl">📡</div>
      <h1 className="text-xl font-semibold">Sin conexión</h1>
      <p className="text-sm opacity-70">Revisá tu conexión a internet y volvé a intentar.</p>
    </main>
  );
}
