-- =============================================================================
-- Administradores del sistema (superusuarios) y moderación de usuarios
-- -----------------------------------------------------------------------------
-- - Nadie puede auto-promoverse: system_admins solo se escribe con la secret
--   key (script BackEnd/scripts/create-system-admin.ts).
-- - El bloqueo usa el mecanismo nativo de Supabase Auth (auth.users.banned_until):
--   un usuario bloqueado no puede iniciar sesión ni refrescar su token.
-- - El voto MVP sigue siendo anónimo también para estos admins (el modelo no
--   guarda quién votó a quién).
-- =============================================================================

create table public.system_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.system_admins is 'Superusuarios de la app. Solo se escribe con la secret key (service_role).';

alter table public.system_admins enable row level security;
revoke all on table public.system_admins from anon, authenticated;
grant all on table public.system_admins to service_role;

-- -----------------------------------------------------------------------------
-- Auditoría de acciones de moderación
-- -----------------------------------------------------------------------------
create table public.admin_audit_log (
  id              bigint generated always as identity primary key,
  admin_id        uuid not null references auth.users (id) on delete cascade,
  action          text not null,
  target_user_id  uuid references auth.users (id) on delete set null,
  -- Se completa desde la Etapa 2 (moderación de partidos).
  target_match_id uuid,
  created_at      timestamptz not null default now()
);

create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- ¿El usuario actual es admin del sistema?
create function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.system_admins where user_id = (select auth.uid()));
$$;

-- ¿El usuario está bloqueado? Lo usan las RPC de escritura de las próximas
-- etapas (el token vigente de un usuario bloqueado puede durar hasta 1 hora).
create function public.is_blocked(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.banned_until > now() from auth.users u where u.id = p_user_id), false);
$$;

-- Estado de la cuenta del usuario actual (una sola llamada desde el layout).
create function public.my_account_flags()
returns table (is_system_admin boolean, is_blocked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_system_admin(), public.is_blocked((select auth.uid()));
$$;

create function public.assert_system_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_system_admin() then
    raise exception 'Solo un administrador del sistema puede hacer esto' using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS del log: solo lo leen los admins del sistema; se escribe desde las RPC.
-- -----------------------------------------------------------------------------
alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from anon, authenticated;
grant select on table public.admin_audit_log to authenticated;

create policy "admin_audit_log: solo admins del sistema"
  on public.admin_audit_log for select
  to authenticated
  using ((select public.is_system_admin()));

-- -----------------------------------------------------------------------------
-- RPC de gestión de usuarios
-- -----------------------------------------------------------------------------

-- Listado de usuarios con datos de contacto (solo admins del sistema).
create function public.admin_list_users(p_search text default null)
returns table (
  id              uuid,
  email           text,
  first_name      text,
  last_name       text,
  nickname        text,
  phone           text,
  created_at      timestamptz,
  is_blocked      boolean,
  is_system_admin boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q text := nullif(btrim(p_search), '');
begin
  perform public.assert_system_admin();

  return query
    select u.id,
           u.email::text,
           p.first_name,
           p.last_name,
           p.nickname,
           p.phone,
           u.created_at,
           coalesce(u.banned_until > now(), false),
           exists (select 1 from public.system_admins sa where sa.user_id = u.id)
    from auth.users u
    left join public.profiles p on p.id = u.id
    where q is null
       or u.email ilike '%' || q || '%'
       or p.first_name ilike '%' || q || '%'
       or p.last_name ilike '%' || q || '%'
       or p.nickname ilike '%' || q || '%'
       or p.phone like '%' || regexp_replace(q, '\D', '', 'g') || '%' and regexp_replace(q, '\D', '', 'g') <> ''
    order by u.created_at desc
    limit 200;
end;
$$;

-- Bloquear / desbloquear un usuario.
create function public.admin_set_user_blocked(p_user_id uuid, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_system_admin();

  if p_user_id = (select auth.uid()) then
    raise exception 'No podés bloquear tu propia cuenta' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.system_admins where user_id = p_user_id) then
    raise exception 'No se puede bloquear a un administrador del sistema' using errcode = 'P0001';
  end if;

  -- Misma duración que usa Supabase para un "ban" indefinido (100 años).
  update auth.users
     set banned_until = case when p_blocked then now() + interval '100 years' else null end
   where id = p_user_id;
  if not found then
    raise exception 'El usuario no existe' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_user_id)
  values ((select auth.uid()), case when p_blocked then 'user.block' else 'user.unblock' end, p_user_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución
-- -----------------------------------------------------------------------------
revoke execute on function public.is_system_admin()               from public, anon;
revoke execute on function public.is_blocked(uuid)                from public, anon, authenticated;
revoke execute on function public.my_account_flags()              from public, anon;
revoke execute on function public.assert_system_admin()           from public, anon, authenticated;
revoke execute on function public.admin_list_users(text)          from public, anon;
revoke execute on function public.admin_set_user_blocked(uuid, boolean) from public, anon;

grant execute on function public.is_system_admin()                to authenticated;
grant execute on function public.my_account_flags()               to authenticated;
grant execute on function public.admin_list_users(text)           to authenticated;
grant execute on function public.admin_set_user_blocked(uuid, boolean) to authenticated;
