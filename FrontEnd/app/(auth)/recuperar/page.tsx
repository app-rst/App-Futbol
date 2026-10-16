import Link from "next/link";
import { ResetRequestForm } from "./reset-request-form";

export const metadata = { title: "Recuperar contraseña" };

export default function RecoverPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Recuperar contraseña</h1>
        <p className="text-sm opacity-70">Te mandamos un link por email para elegir una nueva.</p>
      </div>
      <ResetRequestForm />
      <Link href="/login" className="text-center text-sm underline underline-offset-4 opacity-70">
        Volver a iniciar sesión
      </Link>
    </div>
  );
}
