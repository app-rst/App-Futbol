"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button-styles";

/** Copia el link de invitación al portapapeles. */
export function ShareButton({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);

  const url = () => `${window.location.origin}/p/${inviteCode}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiá el link:", url());
    }
  }

  return (
    <button type="button" onClick={copy} className={buttonClass("secondary", "w-full")} aria-live="polite">
      {copied ? "¡Copiado!" : "Copiar link"}
    </button>
  );
}
