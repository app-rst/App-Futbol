"use client";

import { useEffect } from "react";
import { buttonClass } from "@/components/ui/button-styles";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <div className="text-5xl" aria-hidden>
        😵
      </div>
      <h1 className="text-xl font-semibold">Algo salió mal</h1>
      <p className="text-sm opacity-70">
        No pudimos cargar la información. Revisá tu conexión y volvé a intentar en unos segundos.
      </p>
      <button type="button" onClick={reset} className={buttonClass("primary", "w-full")}>
        Reintentar
      </button>
    </main>
  );
}
