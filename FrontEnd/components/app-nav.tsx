"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Partidos", icon: "⚽" },
  { href: "/historial", label: "Historial", icon: "📜" },
  { href: "/perfil", label: "Perfil", icon: "👤" },
];

const ADMIN_ITEM = { href: "/admin", label: "Admin", icon: "🛡️" };

/** Barra inferior (estilo app) para la navegación principal en el celular. */
export function AppNav({ isSystemAdmin = false }: { isSystemAdmin?: boolean }) {
  const pathname = usePathname();
  const items = isSystemAdmin ? [...ITEMS, ADMIN_ITEM] : ITEMS;
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-black/10 bg-[var(--background)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-white/10"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                  active ? "font-semibold text-green-700 dark:text-green-400" : "opacity-60"
                }`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
