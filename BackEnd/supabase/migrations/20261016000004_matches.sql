-- =============================================================================
-- Partidos e inscriptos (Etapa 2: crear, editar, compartir y ver)
-- -----------------------------------------------------------------------------
-- Reglas generales:
-- - Los clientes NO escriben directo en las tablas: todo pasa por funciones
--   security definer que bloquean la fila del partido (select … for update),
--   así las operaciones sobre un mismo partido se ejecutan de a una.
-- - El rol (titular/suplente) NO se guarda: titular = posición (orden de
--   inscripción) <= starters_count. La promoción de suplentes es automática.
-- - Los demás jugadores solo ven el nombre visible (apodo o nombre). El celular
--   lo ven el admin del partido y los admins del sistema.
-- =============================================================================

create type public.match_status as enum ('open', 'cancelled');

create table public.matches (
  id               uuid primary key default gen_random_uuid(),
  admin_id         uuid not null references auth.users (id),
  -- Quién lo creó (el admin puede cambiar si se baja). Permite duplicarlo.
  created_by       uuid references auth.users (id) on delete set null,
  invite_code      text not null unique,
  location         text not null,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  starters_count   integer not null,
  field_cost       numeric(12, 2) not null,
  signup_deadline  timestamptz not null,
  status           public.match_status not null default 'open',
  cancelled_at     timestamptz,
  -- Resultado (Etapa 5).
  team_a_goals     integer,
  team_b_goals     integer,
  result_loaded_at timestamptz,
  duplicated_from  uuid references public.matches (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint matches_location_len    check (char_length(btrim(location)) between 1 and 120),
  constraint matches_times           check (ends_at > starts_at),
  constraint matches_duration        check (ends_at - starts_at <= interval '8 hours'),
  constraint matches_deadline        check (signup_deadline <= starts_at),
  constraint matches_starters_count  check (starters_count between 10 and 40),
  constraint matches_field_cost      check (field_cost >= 0 and field_cost <= 100000000),
  constraint matches_goals           check (coalesce(team_a_goals, 0) >= 0 and coalesce(team_b_goals, 0) >= 0)
);

create index matches_admin_id_idx on public.matches (admin_id);
create index matches_starts_at_idx on public.matches (starts_at);

create table public.match_players (
  match_id  uuid not null references public.matches (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  -- Orden de inscripción (global y creciente: alcanza para ordenar dentro del partido).
  seq       bigint generated always as identity,
  joined_at timestamptz not null default now(),
  team      char(1),
  primary key (match_id, user_id),
  constraint match_players_team check (team in ('A', 'B'))
);

create index match_players_match_seq_idx on public.match_players (match_id, seq);
create index match_players_user_idx on public.match_players (user_id);

-- -----------------------------------------------------------------------------
-- Helpers internos
-- -----------------------------------------------------------------------------

create function public.new_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 12);
$$;

create function public.is_match_participant(p_match_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.match_players where match_id = p_match_id and user_id = p_user_id)
      or exists (select 1 from public.matches where id = p_match_id and admin_id = p_user_id);
$$;

-- Usuario habilitado para jugar/organizar: logueado, no bloqueado, perfil completo.
create function public.assert_can_play()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión' using errcode = '42501';
  end if;
  if public.is_blocked(v_uid) then
    raise exception 'Tu cuenta está suspendida' using errcode = '42501';
  end if;
  if not public.is_profile_complete(v_uid) then
    raise exception 'Completá tu perfil (nombre, apellido y celular) antes de continuar' using errcode = 'P0001';
  end if;
  return v_uid;
end;
$$;

-- Validaciones de los datos del partido con mensajes para el usuario.
create function public.validate_match_input(
  p_location text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_starters_count integer, p_field_cost numeric, p_signup_deadline timestamptz
)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_location is null or char_length(btrim(p_location)) = 0 then
    raise exception 'Ingresá el lugar del partido' using errcode = 'P0001';
  end if;
  if char_length(btrim(p_location)) > 120 then
    raise exception 'El lugar puede tener hasta 120 caracteres' using errcode = 'P0001';
  end if;
  if p_starts_at is null or p_ends_at is null or p_signup_deadline is null then
    raise exception 'Completá la fecha y los horarios' using errcode = 'P0001';
  end if;
  if p_starts_at <= now() then
    raise exception 'La fecha y hora de inicio tienen que ser futuras' using errcode = 'P0001';
  end if;
  if p_starts_at > now() + interval '1 year' then
    raise exception 'El partido tiene que ser dentro del próximo año' using errcode = 'P0001';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'La hora de fin tiene que ser posterior a la de inicio' using errcode = 'P0001';
  end if;
  if p_ends_at - p_starts_at > interval '8 hours' then
    raise exception 'El partido no puede durar más de 8 horas' using errcode = 'P0001';
  end if;
  if p_signup_deadline > p_starts_at then
    raise exception 'El límite de inscripción tiene que ser antes del inicio' using errcode = 'P0001';
  end if;
  if p_starters_count is null or p_starters_count < 10 then
    raise exception 'Tiene que haber al menos 10 titulares' using errcode = 'P0001';
  end if;
  if p_starters_count > 40 then
    raise exception 'Máximo 40 titulares' using errcode = 'P0001';
  end if;
  if p_field_cost is null or p_field_cost < 0 then
    raise exception 'El costo de la cancha no puede ser negativo' using errcode = 'P0001';
  end if;
  if p_field_cost > 100000000 then
    raise exception 'El costo de la cancha es demasiado alto' using errcode = 'P0001';
  end if;
end;
$$;

-- Plantel ordenado con rol derivado. Uso interno (incluye datos privados).
create function public.match_roster_internal(p_match_id uuid)
returns table (
  user_id      uuid,
  "position"   bigint,
  is_starter   boolean,
  team         char(1),
  display_name text,
  phone        text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.user_id, r.pos, r.pos <= m.starters_count, r.team, r.display_name, r.phone
  from public.matches m
  join (
    select mp.match_id, mp.user_id, mp.team,
           row_number() over (order by mp.seq) as pos,
           coalesce(p.nickname, p.first_name, 'Jugador') as display_name,
           p.phone
    from public.match_players mp
    left join public.profiles p on p.id = mp.user_id
    where mp.match_id = p_match_id
  ) r on r.match_id = m.id
  where m.id = p_match_id
  order by r.pos;
$$;

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger matches_touch_updated_at
  before update on public.matches
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: lectura directa solo de lo propio. Escrituras únicamente vía RPC.
-- -----------------------------------------------------------------------------
alter table public.matches enable row level security;
alter table public.match_players enable row level security;

revoke all on table public.matches from anon, authenticated;
revoke all on table public.match_players from anon, authenticated;
grant select on table public.matches to authenticated;
grant select on table public.match_players to authenticated;

create policy "matches: participantes y admins del sistema"
  on public.matches for select
  to authenticated
  using (
    admin_id = (select auth.uid())
    -- match_players solo deja ver las inscripciones propias, así que esto
    -- equivale a "estoy inscripto en este partido".
    or exists (select 1 from public.match_players mp where mp.match_id = id and mp.user_id = (select auth.uid()))
    or (select public.is_system_admin())
  );

create policy "match_players: solo las propias inscripciones"
  on public.match_players for select
  to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- RPC: crear partido (el creador queda inscripto como titular #1)
-- -----------------------------------------------------------------------------
create function public.create_match(
  p_location text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_starters_count integer,
  p_field_cost numeric,
  p_signup_deadline timestamptz,
  p_duplicated_from uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_can_play();
  v_id  uuid;
  v_code text;
begin
  perform public.validate_match_input(p_location, p_starts_at, p_ends_at, p_starters_count, p_field_cost, p_signup_deadline);

  if p_duplicated_from is not null and not exists (
    select 1 from public.matches
    where id = p_duplicated_from and (admin_id = v_uid or created_by = v_uid)
  ) then
    raise exception 'Solo podés duplicar partidos que organizaste' using errcode = '42501';
  end if;

  -- Código de invitación único (reintenta ante una colisión, muy improbable).
  loop
    v_code := public.new_invite_code();
    exit when not exists (select 1 from public.matches where invite_code = v_code);
  end loop;

  insert into public.matches (
    admin_id, created_by, invite_code, location, starts_at, ends_at,
    starters_count, field_cost, signup_deadline, duplicated_from
  ) values (
    v_uid, v_uid, v_code, btrim(p_location), p_starts_at, p_ends_at,
    p_starters_count, p_field_cost, p_signup_deadline, p_duplicated_from
  )
  returning id into v_id;

  insert into public.match_players (match_id, user_id) values (v_id, v_uid);

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: editar partido (solo el admin, antes del inicio). Si baja la cantidad de
-- titulares, los que pasan a suplentes pierden el equipo asignado.
-- -----------------------------------------------------------------------------
create function public.update_match(
  p_match_id uuid,
  p_location text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_starters_count integer,
  p_field_cost numeric,
  p_signup_deadline timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_can_play();
  m public.matches;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'El partido no existe' using errcode = 'P0002';
  end if;
  if m.admin_id <> v_uid then
    raise exception 'Solo el admin del partido puede editarlo' using errcode = '42501';
  end if;
  if m.status = 'cancelled' then
    raise exception 'El partido está cancelado' using errcode = 'P0001';
  end if;
  if m.starts_at <= now() then
    raise exception 'El partido ya empezó: no se puede editar' using errcode = 'P0001';
  end if;

  perform public.validate_match_input(p_location, p_starts_at, p_ends_at, p_starters_count, p_field_cost, p_signup_deadline);

  update public.matches
     set location = btrim(p_location),
         starts_at = p_starts_at,
         ends_at = p_ends_at,
         starters_count = p_starters_count,
         field_cost = p_field_cost,
         signup_deadline = p_signup_deadline
   where id = p_match_id;

  -- Los que quedaron como suplentes no pueden tener equipo.
  update public.match_players mp
     set team = null
    from public.match_roster_internal(p_match_id) r
   where mp.match_id = p_match_id
     and mp.user_id = r.user_id
     and not r.is_starter
     and mp.team is not null;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: vista completa de un partido (datos + plantel + permisos del que mira)
-- Acceso por id: participantes y admins del sistema.
-- Acceso por código de invitación: cualquier usuario logueado (es el link).
-- -----------------------------------------------------------------------------
create function public.get_match_view(p_match_id uuid default null, p_invite_code text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_sys boolean := public.is_system_admin();
  m public.matches;
  v_is_participant boolean;
  v_can_see_phones boolean;
  v_roster jsonb;
  v_count integer;
  v_my_position bigint;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión' using errcode = '42501';
  end if;

  if p_match_id is not null then
    select * into m from public.matches where id = p_match_id;
  elsif p_invite_code is not null then
    select * into m from public.matches where invite_code = lower(btrim(p_invite_code));
  end if;
  if m.id is null then
    raise exception 'El partido no existe' using errcode = 'P0002';
  end if;

  v_is_participant := public.is_match_participant(m.id, v_uid);
  -- Por id, un tercero no puede saber ni que el partido existe.
  if p_match_id is not null and not v_is_participant and not v_sys then
    raise exception 'El partido no existe' using errcode = 'P0002';
  end if;

  v_can_see_phones := (m.admin_id = v_uid) or v_sys;

  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', r.user_id,
           'position', r."position",
           'is_starter', r.is_starter,
           'team', r.team,
           'display_name', r.display_name,
           'is_admin', r.user_id = m.admin_id,
           'is_me', r.user_id = v_uid,
           'phone', case when v_can_see_phones then r.phone end
         ) order by r."position"), '[]'::jsonb),
         count(*),
         max(r."position") filter (where r.user_id = v_uid)
    into v_roster, v_count, v_my_position
  from public.match_roster_internal(m.id) r;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', m.id,
      'invite_code', m.invite_code,
      'location', m.location,
      'starts_at', m.starts_at,
      'ends_at', m.ends_at,
      'starters_count', m.starters_count,
      'field_cost', m.field_cost,
      'signup_deadline', m.signup_deadline,
      'status', m.status,
      'cancelled_at', m.cancelled_at,
      'team_a_goals', m.team_a_goals,
      'team_b_goals', m.team_b_goals,
      'result_loaded_at', m.result_loaded_at
    ),
    'players_count', v_count,
    'roster', v_roster,
    'viewer', jsonb_build_object(
      'is_admin', m.admin_id = v_uid,
      'is_participant', v_is_participant,
      'is_system_admin', v_sys,
      'position', v_my_position,
      'is_starter', v_my_position is not null and v_my_position <= m.starters_count,
      'can_duplicate', m.admin_id = v_uid or m.created_by = v_uid
    )
  );
end;
$$;

-- Datos para precargar el formulario al duplicar (solo partidos que organizaste).
create function public.get_match_template(p_match_id uuid)
returns table (
  location text, starts_at timestamptz, ends_at timestamptz,
  starters_count integer, field_cost numeric, signup_deadline timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  return query
    select m.location, m.starts_at, m.ends_at, m.starters_count, m.field_cost, m.signup_deadline
    from public.matches m
    where m.id = p_match_id and (m.admin_id = v_uid or m.created_by = v_uid);
  if not found then
    raise exception 'Solo podés duplicar partidos que organizaste' using errcode = '42501';
  end if;
end;
$$;

-- Mis partidos (donde estoy inscripto o soy admin).
create function public.my_matches()
returns table (
  id               uuid,
  location         text,
  starts_at        timestamptz,
  ends_at          timestamptz,
  status           public.match_status,
  starters_count   integer,
  players_count    bigint,
  my_position      bigint,
  is_admin         boolean,
  team_a_goals     integer,
  team_b_goals     integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select m.*
    from public.matches m
    where m.admin_id = (select auth.uid())
       or exists (select 1 from public.match_players mp where mp.match_id = m.id and mp.user_id = (select auth.uid()))
  )
  select m.id, m.location, m.starts_at, m.ends_at, m.status, m.starters_count,
         (select count(*) from public.match_players mp where mp.match_id = m.id),
         (select r.pos from (
            select mp.user_id, row_number() over (order by mp.seq) as pos
            from public.match_players mp where mp.match_id = m.id
          ) r where r.user_id = (select auth.uid())),
         m.admin_id = (select auth.uid()),
         m.team_a_goals, m.team_b_goals
  from mine m
  order by m.starts_at;
$$;

-- Todos los partidos (panel del admin del sistema).
create function public.admin_list_matches(p_filter text default 'upcoming')
returns table (
  id             uuid,
  location       text,
  starts_at      timestamptz,
  ends_at        timestamptz,
  status         public.match_status,
  starters_count integer,
  players_count  bigint,
  admin_name     text,
  team_a_goals   integer,
  team_b_goals   integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_system_admin();
  return query
    select m.id, m.location, m.starts_at, m.ends_at, m.status, m.starters_count,
           (select count(*) from public.match_players mp where mp.match_id = m.id),
           (select coalesce(p.nickname, p.first_name, 'Jugador') || coalesce(' ' || p.last_name, '')
              from public.profiles p where p.id = m.admin_id),
           m.team_a_goals, m.team_b_goals
    from public.matches m
    where case coalesce(p_filter, 'upcoming')
            when 'upcoming'  then m.status = 'open' and m.ends_at > now()
            when 'past'      then m.status = 'open' and m.ends_at <= now()
            when 'cancelled' then m.status = 'cancelled'
            else true
          end
    order by case when coalesce(p_filter, 'upcoming') = 'upcoming' then m.starts_at end asc,
             m.starts_at desc
    limit 300;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución
-- -----------------------------------------------------------------------------
revoke execute on function public.new_invite_code()                       from public, anon, authenticated;
revoke execute on function public.is_match_participant(uuid, uuid)        from public, anon, authenticated;
revoke execute on function public.assert_can_play()                       from public, anon, authenticated;
revoke execute on function public.validate_match_input(text, timestamptz, timestamptz, integer, numeric, timestamptz) from public, anon, authenticated;
revoke execute on function public.match_roster_internal(uuid)             from public, anon, authenticated;
revoke execute on function public.touch_updated_at()                      from public, anon, authenticated;

revoke execute on function public.create_match(text, timestamptz, timestamptz, integer, numeric, timestamptz, uuid) from public, anon;
revoke execute on function public.update_match(uuid, text, timestamptz, timestamptz, integer, numeric, timestamptz) from public, anon;
revoke execute on function public.get_match_view(uuid, text)              from public, anon;
revoke execute on function public.get_match_template(uuid)                from public, anon;
revoke execute on function public.my_matches()                            from public, anon;
revoke execute on function public.admin_list_matches(text)                from public, anon;

grant execute on function public.create_match(text, timestamptz, timestamptz, integer, numeric, timestamptz, uuid) to authenticated;
grant execute on function public.update_match(uuid, text, timestamptz, timestamptz, integer, numeric, timestamptz) to authenticated;
grant execute on function public.get_match_view(uuid, text)               to authenticated;
grant execute on function public.get_match_template(uuid)                 to authenticated;
grant execute on function public.my_matches()                             to authenticated;
grant execute on function public.admin_list_matches(text)                 to authenticated;
