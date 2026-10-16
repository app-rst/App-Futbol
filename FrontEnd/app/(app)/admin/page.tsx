import Link from "next/link";
import { requireSystemAdmin } from "@/lib/auth";
import { MATCH_FILTERS, MatchesTab, type MatchFilter } from "./matches-tab";
import { UsersTab } from "./users-tab";

export const metadata = { title: "Administración" };

const TABS = { usuarios: "Usuarios", partidos: "Partidos" } as const;
type Tab = keyof typeof TABS;

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const me = await requireSystemAdmin();
  const sp = await searchParams;
  const tab: Tab = sp.tab === "partidos" ? "partidos" : "usuarios";
  const q = typeof sp.q === "string" ? sp.q : "";
  const filter: MatchFilter =
    typeof sp.filtro === "string" && sp.filtro in MATCH_FILTERS ? (sp.filtro as MatchFilter) : "upcoming";

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold">Administración</h1>
        <p className="text-sm opacity-60">Panel del administrador del sistema</p>
      </header>

      <nav aria-label="Secciones" className="flex gap-2 rounded-xl bg-black/5 p-1 text-sm dark:bg-white/10">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <Link
            key={t}
            href={`/admin?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={`flex-1 rounded-lg py-2 text-center ${
              t === tab ? "bg-white font-semibold shadow-sm dark:bg-white/15" : "opacity-70"
            }`}
          >
            {TABS[t]}
          </Link>
        ))}
      </nav>

      {tab === "usuarios" ? <UsersTab q={q} meId={me.id} /> : <MatchesTab filter={filter} />}
    </>
  );
}
