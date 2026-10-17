import Link from "next/link";
import { Divider, GoogleButton } from "@/components/auth/google-button";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { SignUpForm } from "./signup-form";

export const metadata = { title: "Crear cuenta" };

export default async function SignUpPage({ searchParams }: PageProps<"/registro">) {
  const next = safeNext((await searchParams).next);
  const qs = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Crear cuenta</h1>
      {env.googleAuth && (
        <>
          <GoogleButton next={next} />
          <Divider />
        </>
      )}
      <SignUpForm next={next} />
      <p className="text-center text-sm">
        ¿Ya tenés cuenta?{" "}
        <Link href={`/login${qs}`} className="font-semibold text-green-700 underline underline-offset-4 dark:text-green-400">
          Iniciá sesión
        </Link>
      </p>
    </div>
  );
}
