import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { getUserClaims } from "@/lib/auth";
import { NewPasswordForm } from "./new-password-form";

export const metadata = { title: "Nueva contraseña" };

export default async function NewPasswordPage() {
  // Se llega desde el link del email, que ya dejó la sesión iniciada.
  const user = await getUserClaims();
  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <Alert kind="error">El link es inválido o ya venció.</Alert>
        <Link href="/recuperar" className="text-center text-sm underline underline-offset-4">
          Pedir un link nuevo
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Elegí una contraseña nueva</h1>
      <NewPasswordForm />
    </div>
  );
}
