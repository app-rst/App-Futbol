import Link from "next/link";
import { Divider, GoogleButton } from "@/components/auth/google-button";
import { Alert } from "@/components/ui/alert";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "./login-form";

export const metadata = { title: "Iniciar sesión" };

const ERRORS: Record<string, string> = {
  google: "No pudimos iniciar sesión con Google. Volvé a intentar.",
  link: "El link es inválido o ya venció. Pedí uno nuevo.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const qs = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Iniciar sesión</h1>
      {error && <Alert kind="error">{error}</Alert>}
      <GoogleButton next={next} />
      <Divider />
      <LoginForm next={next} />
      <div className="flex flex-col items-center gap-2 text-sm">
        <Link href={`/recuperar${qs}`} className="underline underline-offset-4 opacity-70">
          Me olvidé la contraseña
        </Link>
        <p>
          ¿No tenés cuenta?{" "}
          <Link href={`/registro${qs}`} className="font-semibold text-green-700 underline underline-offset-4 dark:text-green-400">
            Registrate
          </Link>
        </p>
      </div>
    </div>
  );
}
