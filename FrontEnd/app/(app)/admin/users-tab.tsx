import { formatDate } from "@/lib/dates";
import { formatArPhone, whatsappLink } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { BlockButton } from "./block-button";

type AdminUser = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  phone: string | null;
  created_at: string;
  is_blocked: boolean;
  is_system_admin: boolean;
};

export async function UsersTab({ q, meId }: { q: string; meId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users", { p_search: q || null });
  const users = (data ?? []) as AdminUser[];

  return (
    <>
      <form role="search" className="flex gap-2">
        <input type="hidden" name="tab" value="usuarios" />
        <label htmlFor="q" className="sr-only">
          Buscar usuarios
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Nombre, apodo, email o celular"
          className="h-11 flex-1 rounded-xl border border-black/15 bg-white px-3 text-base outline-none focus:border-green-700 dark:border-white/15 dark:bg-white/5"
        />
        <button type="submit" className="h-11 rounded-xl bg-green-700 px-4 text-sm font-semibold text-white">
          Buscar
        </button>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          No se pudo cargar el listado de usuarios.
        </p>
      ) : (
        <section aria-label="Usuarios" className="flex flex-col gap-3">
          <p className="text-xs opacity-60">
            {users.length === 200 ? "Mostrando los 200 más recientes" : `${users.length} usuario${users.length === 1 ? "" : "s"}`}
          </p>
          {users.length === 0 && <p className="text-sm opacity-70">No hay usuarios que coincidan con la búsqueda.</p>}
          {users.map((u) => {
            const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ") || "Sin nombre";
            return (
              <article
                key={u.id}
                className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {fullName}
                      {u.nickname && <span className="font-normal opacity-60"> · {u.nickname}</span>}
                    </p>
                    <p className="truncate text-sm opacity-70">{u.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {u.is_system_admin && (
                      <span className="rounded-full bg-green-700/10 px-2 py-0.5 text-xs font-semibold text-green-800 dark:text-green-300">
                        Admin
                      </span>
                    )}
                    {u.is_blocked && (
                      <span className="rounded-full bg-red-600/10 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
                        Bloqueado
                      </span>
                    )}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs opacity-60">Celular</dt>
                    <dd>
                      {u.phone ? (
                        <a href={whatsappLink(u.phone)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                          {formatArPhone(u.phone)}
                        </a>
                      ) : (
                        <span className="opacity-50">Sin cargar</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs opacity-60">Alta</dt>
                    <dd>{formatDate(u.created_at)}</dd>
                  </div>
                </dl>
                {!u.is_system_admin && u.id !== meId && (
                  <BlockButton userId={u.id} name={u.nickname ?? u.first_name ?? u.email ?? "este usuario"} blocked={u.is_blocked} />
                )}
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
