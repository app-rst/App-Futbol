// Clases de botón compartidas. Este módulo NO es "use client" para que lo
// puedan usar tanto Server Components (p. ej. un <Link> con estilo de botón)
// como Client Components.

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "gold";

const base =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-green-700 text-white hover:bg-green-800",
  secondary:
    "border border-black/15 bg-white hover:bg-black/5 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "hover:bg-black/5 dark:hover:bg-white/10",
  gold: "bg-amber-500 text-black hover:bg-amber-600",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}
