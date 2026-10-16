export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="text-4xl" aria-hidden>
          ⚽
        </div>
        <p className="text-2xl font-bold tracking-tight">Fulbito</p>
        <p className="text-sm opacity-60">Organizá partidos con tus amigos</p>
      </div>
      {children}
    </main>
  );
}
