import Link from "next/link";
import { buttonClass } from "@/components/ui/button-styles";

export const metadata = { title: "No encontrado" };

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <div className="text-5xl" aria-hidden>
        🥅
      </div>
      <h1 className="text-xl font-semibold">Esta página no existe</h1>
      <p className="text-sm opacity-70">
        Puede que el link esté mal escrito, que el partido haya sido borrado o que no tengas acceso.
      </p>
      <Link href="/" className={buttonClass("primary", "w-full")}>
        Ir a mis partidos
      </Link>
    </main>
  );
}
