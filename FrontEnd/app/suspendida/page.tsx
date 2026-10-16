import { signOut } from "@/app/actions/auth";
import { SubmitButton } from "@/components/ui/button";

export const metadata = { title: "Cuenta suspendida" };

export default function SuspendedPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <div className="text-5xl" aria-hidden>
        🚫
      </div>
      <h1 className="text-xl font-semibold">Tu cuenta está suspendida</h1>
      <p className="text-sm opacity-70">
        Un administrador bloqueó tu cuenta, así que no podés usar la app. Si creés que es un error, contactá a un
        administrador.
      </p>
      <form action={signOut} className="w-full">
        <SubmitButton variant="secondary" className="w-full" pendingText="Saliendo…">
          Cerrar sesión
        </SubmitButton>
      </form>
    </main>
  );
}
