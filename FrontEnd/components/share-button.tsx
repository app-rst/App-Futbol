"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button-styles";

/**
 * Comparte el link de invitación: usa la hoja nativa del celular (Web Share
 * API) y, si no está disponible, abre WhatsApp con el mensaje armado.
 */
export function ShareButton({ inviteCode, text }: { inviteCode: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const url = () => `${window.location.origin}/p/${inviteCode}`;

  async function share() {
    const link = url();
    if (navigator.share) {
      try {
        await navigator.share({ title: "Partido de fútbol", text, url: link });
        return;
      } catch (err) {
        // El usuario cerró la hoja de compartir: no hacer nada.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${link}`)}`, "_blank", "noopener,noreferrer");
  }

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
    <div className="flex gap-2">
      <button type="button" onClick={share} className={buttonClass("primary", "flex-1 bg-[#25D366] text-black hover:bg-[#1ebe5b]")}>
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
          <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zM12 0a12 12 0 0 0-10.3 18L0 24l6.2-1.6A12 12 0 1 0 12 0z" />
        </svg>
        Compartir
      </button>
      <button type="button" onClick={copy} className={buttonClass("secondary", "px-3 text-sm")} aria-live="polite">
        {copied ? "¡Copiado!" : "Copiar link"}
      </button>
    </div>
  );
}
