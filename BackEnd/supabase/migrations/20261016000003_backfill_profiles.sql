-- =============================================================================
-- Backfill de perfiles
-- -----------------------------------------------------------------------------
-- Las cuentas creadas ANTES de aplicar la migración de perfiles no tienen fila
-- en public.profiles (el trigger todavía no existía), aunque sus datos están en
-- auth.users.raw_user_meta_data. Esta migración:
--   1. Extrae la lógica de "metadata → perfil" a una función reutilizable.
--   2. Hace que el trigger handle_new_user la use.
--   3. Crea los perfiles faltantes. Es idempotente: no toca perfiles existentes.
-- =============================================================================

-- Datos del perfil a partir de los metadatos del registro (email o Google).
create function public.profile_from_metadata(meta jsonb)
returns table (first_name text, last_name text, nickname text, phone text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  m jsonb := coalesce(meta, '{}'::jsonb);
  full_name text := coalesce(m ->> 'full_name', m ->> 'name');
  v_phone text := nullif(btrim(m ->> 'phone'), '');
begin
  first_name := left(nullif(btrim(coalesce(m ->> 'first_name', m ->> 'given_name',
                                           split_part(full_name, ' ', 1))), ''), 50);
  last_name  := left(nullif(btrim(coalesce(m ->> 'last_name', m ->> 'family_name',
                                           nullif(btrim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), ''))), ''), 50);
  nickname   := left(nullif(btrim(m ->> 'nickname'), ''), 30);
  -- Un celular inválido no debe impedir el registro: queda vacío y se pide en el onboarding.
  phone      := case when v_phone ~ '^\+549[0-9]{10}$' then v_phone end;
  return next;
end;
$$;

revoke execute on function public.profile_from_metadata(jsonb) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, nickname, phone)
  select new.id, d.first_name, d.last_name, d.nickname, d.phone
  from public.profile_from_metadata(new.raw_user_meta_data) d
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Perfiles faltantes para las cuentas ya existentes.
insert into public.profiles (id, first_name, last_name, nickname, phone)
select u.id, d.first_name, d.last_name, d.nickname, d.phone
from auth.users u
cross join lateral public.profile_from_metadata(u.raw_user_meta_data) d
where not exists (select 1 from public.profiles p where p.id = u.id);
