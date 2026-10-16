-- =============================================================================
-- Perfiles de usuario
-- -----------------------------------------------------------------------------
-- Datos privados: cada usuario ve y edita SOLO su propia fila. Los demás
-- jugadores nunca leen esta tabla directamente; ven el "nombre visible"
-- (apodo o nombre) a través de funciones security definer.
-- El email vive en auth.users y no se duplica acá.
-- =============================================================================

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text,
  last_name   text,
  nickname    text,
  -- Celular argentino en formato E.164: +549 + código de área + número (10 dígitos).
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint profiles_first_name_len check (first_name is null or char_length(btrim(first_name)) between 1 and 50),
  constraint profiles_last_name_len  check (last_name  is null or char_length(btrim(last_name))  between 1 and 50),
  constraint profiles_nickname_len   check (nickname   is null or char_length(btrim(nickname))   between 1 and 30),
  constraint profiles_phone_format   check (phone is null or phone ~ '^\+549[0-9]{10}$')
);

comment on table public.profiles is 'Datos personales del usuario. Privados: solo los lee el dueño (el celular también lo ve el admin del partido vía RPC).';

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Perfil completo = puede crear partidos y anotarse. El apodo es opcional.
create function public.is_profile_complete(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.first_name is not null
       and p.last_name  is not null
       and p.phone      is not null
    from public.profiles p
    where p.id = p_user_id
  ), false);
$$;

-- Nombre que ven los demás jugadores: apodo, o nombre si no tiene apodo.
create function public.display_name(p public.profiles)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(p.nickname, p.first_name, 'Jugador');
$$;

-- -----------------------------------------------------------------------------
-- Normalización (trim, vacío → null) y updated_at
-- -----------------------------------------------------------------------------
create function public.profiles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.first_name := nullif(btrim(new.first_name), '');
  new.last_name  := nullif(btrim(new.last_name), '');
  new.nickname   := nullif(btrim(new.nickname), '');
  new.phone      := nullif(btrim(new.phone), '');
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger profiles_before_write
  before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

-- -----------------------------------------------------------------------------
-- Alta automática del perfil al registrarse
-- -----------------------------------------------------------------------------
-- Registro con email: la app manda first_name, last_name, nickname y phone en
-- los metadatos. Google: trae given_name / family_name (o full_name); el
-- celular falta y se completa en /onboarding.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := coalesce(meta ->> 'full_name', meta ->> 'name');
  v_first text;
  v_last  text;
  v_nick  text;
  v_phone text;
begin
  v_first := left(nullif(btrim(coalesce(meta ->> 'first_name', meta ->> 'given_name',
                                        split_part(full_name, ' ', 1))), ''), 50);
  v_last  := left(nullif(btrim(coalesce(meta ->> 'last_name', meta ->> 'family_name',
                                        nullif(btrim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), ''))), ''), 50);
  v_nick  := left(nullif(btrim(meta ->> 'nickname'), ''), 30);
  v_phone := nullif(btrim(meta ->> 'phone'), '');
  -- Un celular inválido en los metadatos no debe impedir el registro: queda
  -- vacío y se pide en el onboarding.
  if v_phone is not null and v_phone !~ '^\+549[0-9]{10}$' then
    v_phone := null;
  end if;

  insert into public.profiles (id, first_name, last_name, nickname, phone)
  values (new.id, v_first, v_last, v_nick, v_phone);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Permisos y RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
-- Solo se pueden modificar los datos editables (no id ni fechas).
grant update (first_name, last_name, nickname, phone) on table public.profiles to authenticated;

create policy "profiles: el usuario lee su propio perfil"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: el usuario edita su propio perfil"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Funciones internas: no expuestas por la API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.profiles_before_write() from public, anon, authenticated;
-- Uso interno de otras funciones (crear partido, anotarse). La app lee el
-- perfil propio directamente.
revoke execute on function public.is_profile_complete(uuid) from public, anon, authenticated;
revoke execute on function public.display_name(public.profiles) from public, anon, authenticated;
