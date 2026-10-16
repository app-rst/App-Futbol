-- =============================================================================
-- Después del partido (Etapa 5): resultado, goleadores y MVP anónimo
-- -----------------------------------------------------------------------------
-- ANONIMATO DEL VOTO MVP
-- - mvp_ballots registra QUE alguien votó (para impedir el doble voto).
-- - mvp_votes guarda A QUIÉN se votó, SIN el votante y sin fecha; su id es un
--   uuid aleatorio, así que el orden de los ids no revela el orden de llegada.
-- - Ambas se escriben juntas dentro de cast_mvp_vote. Ningún rol de la app
--   (jugador, admin del partido, admin del sistema) puede leerlas: el único
--   acceso es get_match_post, que después del cierre devuelve SOLO al MVP (o a
--   los empatados) y nunca conteos de votos.
-- - Límite conocido: alguien con acceso de superusuario a la base podría
--   intentar correlacionar el orden físico de inserción entre ambas tablas.
--   Para los usuarios de la app es imposible saber quién votó a quién.
-- =============================================================================

create table public.match_scorers (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  goals    integer not null,
  primary key (match_id, user_id),
  constraint match_scorers_goals check (goals between 1 and 99)
);

create table public.mvp_ballots (
  match_id uuid not null references public.matches (id) on delete cascade,
  voter_id uuid not null references auth.users (id) on delete cascade,
  primary key (match_id, voter_id)
);

create table public.mvp_votes (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches (id) on delete cascade,
  candidate_id uuid not null references auth.users (id) on delete cascade
);

create index mvp_votes_match_idx on public.mvp_votes (match_id);

-- Sin acceso directo para nadie de la app: todo pasa por las RPC.
alter table public.match_scorers enable row level security;
alter table public.mvp_ballots enable row level security;
alter table public.mvp_votes enable row level security;
revoke all on table public.match_scorers from anon, authenticated;
revoke all on table public.mvp_ballots from anon, authenticated;
revoke all on table public.mvp_votes from anon, authenticated;

-- Ventana de votación: desde el fin del partido hasta 24 horas después.
create function public.mvp_voting_window(m public.matches)
returns table (opens_at timestamptz, closes_at timestamptz)
language sql
immutable
set search_path = ''
as $$
  select m.ends_at, m.ends_at + interval '24 hours';
$$;

-- -----------------------------------------------------------------------------
-- Cargar / editar el resultado (solo el admin del partido, después del fin)
-- p_scorers = [{"user_id": "...", "goals": 2}, ...]
-- -----------------------------------------------------------------------------
create function public.save_result(
  p_match_id uuid,
  p_team_a_goals integer,
  p_team_b_goals integer,
  p_scorers jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  m public.matches;
  s jsonb;
  v_user uuid;
  v_goals integer;
  v_team char(1);
  v_is_starter boolean;
  v_sum_a integer := 0;
  v_sum_b integer := 0;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión' using errcode = '42501';
  end if;
  if not public.is_match_participant(p_match_id, v_uid) then
    raise exception 'El partido no existe' using errcode = 'P0002';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if m.admin_id <> v_uid then
    raise exception 'Solo el admin del partido puede cargar el resultado' using errcode = '42501';
  end if;
  if m.status = 'cancelled' then
    raise exception 'El partido está cancelado' using errcode = 'P0001';
  end if;
  if now() < m.ends_at then
    raise exception 'El resultado se carga cuando termina el partido' using errcode = 'P0001';
  end if;
  if p_team_a_goals is null or p_team_b_goals is null
     or p_team_a_goals not between 0 and 99 or p_team_b_goals not between 0 and 99 then
    raise exception 'Los goles tienen que ser un número entre 0 y 99' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.match_roster_internal(m.id) r where r.is_starter and r.team is null) then
    raise exception 'Antes de cargar el resultado, asigná a todos los titulares a un equipo' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_scorers, '[]'::jsonb)) <> 'array' then
    raise exception 'Formato inválido' using errcode = 'P0001';
  end if;

  delete from public.match_scorers where match_id = m.id;

  for s in select * from jsonb_array_elements(coalesce(p_scorers, '[]'::jsonb)) loop
    v_user := (s ->> 'user_id')::uuid;
    v_goals := (s ->> 'goals')::integer;
    if v_goals is null or v_goals < 1 or v_goals > 99 then
      raise exception 'Cada goleador tiene que tener al menos 1 gol' using errcode = 'P0001';
    end if;
    select r.is_starter, r.team into v_is_starter, v_team
    from public.match_roster_internal(m.id) r where r.user_id = v_user;
    if v_is_starter is not true then
      raise exception 'Los goleadores tienen que ser titulares del partido' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.match_scorers where match_id = m.id and user_id = v_user) then
      raise exception 'Hay un goleador repetido' using errcode = 'P0001';
    end if;
    insert into public.match_scorers (match_id, user_id, goals) values (m.id, v_user, v_goals);
    if v_team = 'A' then v_sum_a := v_sum_a + v_goals; else v_sum_b := v_sum_b + v_goals; end if;
  end loop;

  -- Puede haber menos goles de goleadores que del equipo (goles en contra o
  -- datos incompletos), pero nunca más.
  if v_sum_a > p_team_a_goals then
    raise exception 'Los goleadores del equipo A suman % goles, pero el equipo A hizo %', v_sum_a, p_team_a_goals using errcode = 'P0001';
  end if;
  if v_sum_b > p_team_b_goals then
    raise exception 'Los goleadores del equipo B suman % goles, pero el equipo B hizo %', v_sum_b, p_team_b_goals using errcode = 'P0001';
  end if;

  update public.matches
     set team_a_goals = p_team_a_goals,
         team_b_goals = p_team_b_goals,
         result_loaded_at = now()
   where id = m.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Votar al MVP (titulares, un voto, no a uno mismo, dentro de la ventana)
-- -----------------------------------------------------------------------------
create function public.cast_mvp_vote(p_match_id uuid, p_candidate uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  m public.matches;
  w record;
  v_voter_starter boolean;
  v_candidate_starter boolean;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión' using errcode = '42501';
  end if;
  if public.is_blocked(v_uid) then
    raise exception 'Tu cuenta está suspendida' using errcode = '42501';
  end if;
  if not public.is_match_participant(p_match_id, v_uid) then
    raise exception 'El partido no existe' using errcode = 'P0002';
  end if;

  select * into m from public.matches where id = p_match_id;
  if m.status = 'cancelled' then
    raise exception 'El partido está cancelado' using errcode = 'P0001';
  end if;
  select * into w from public.mvp_voting_window(m);
  if now() < w.opens_at then
    raise exception 'La votación se abre cuando termina el partido' using errcode = 'P0001';
  end if;
  if now() >= w.closes_at then
    raise exception 'La votación ya cerró' using errcode = 'P0001';
  end if;

  select r.is_starter into v_voter_starter from public.match_roster_internal(m.id) r where r.user_id = v_uid;
  if v_voter_starter is not true then
    raise exception 'Solo votan los titulares del partido' using errcode = 'P0001';
  end if;
  if p_candidate = v_uid then
    raise exception 'No te podés votar a vos mismo' using errcode = 'P0001';
  end if;
  select r.is_starter into v_candidate_starter from public.match_roster_internal(m.id) r where r.user_id = p_candidate;
  if v_candidate_starter is not true then
    raise exception 'Solo se puede votar a un titular del partido' using errcode = 'P0001';
  end if;

  begin
    insert into public.mvp_ballots (match_id, voter_id) values (m.id, v_uid);
  exception when unique_violation then
    raise exception 'Ya votaste en este partido' using errcode = 'P0001';
  end;
  -- Sin votante ni fecha: imposible saber de quién es este voto.
  insert into public.mvp_votes (match_id, candidate_id) values (m.id, p_candidate);
end;
$$;

-- -----------------------------------------------------------------------------
-- Todo lo de "después del partido" para la pantalla del partido.
-- -----------------------------------------------------------------------------
create function public.get_match_post(p_match_id uuid)
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
  w record;
  v_is_open boolean;
  v_is_closed boolean;
  v_my_starter boolean;
  v_has_voted boolean;
  v_can_vote boolean;
  v_scorers jsonb;
  v_candidates jsonb := '[]'::jsonb;
  v_mvp jsonb := null;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión' using errcode = '42501';
  end if;
  if not v_sys and not public.is_match_participant(p_match_id, v_uid) then
    raise exception 'El partido no existe' using errcode = 'P0002';
  end if;
  select * into m from public.matches where id = p_match_id;
  if not found then
    raise exception 'El partido no existe' using errcode = 'P0002';
  end if;

  select * into w from public.mvp_voting_window(m);
  v_is_open := m.status = 'open' and now() >= w.opens_at and now() < w.closes_at;
  v_is_closed := m.status = 'open' and now() >= w.closes_at;

  select r.is_starter into v_my_starter from public.match_roster_internal(m.id) r where r.user_id = v_uid;
  v_has_voted := exists (select 1 from public.mvp_ballots where match_id = m.id and voter_id = v_uid);
  v_can_vote := v_is_open and coalesce(v_my_starter, false) and not v_has_voted and not public.is_blocked(v_uid);

  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', s.user_id,
           'display_name', coalesce(p.nickname, p.first_name, 'Jugador'),
           'team', mp.team,
           'goals', s.goals
         ) order by s.goals desc, coalesce(p.nickname, p.first_name)), '[]'::jsonb)
    into v_scorers
  from public.match_scorers s
  left join public.profiles p on p.id = s.user_id
  left join public.match_players mp on mp.match_id = s.match_id and mp.user_id = s.user_id
  where s.match_id = m.id;

  if v_can_vote then
    select coalesce(jsonb_agg(jsonb_build_object('user_id', r.user_id, 'display_name', r.display_name, 'team', r.team)
                              order by r."position"), '[]'::jsonb)
      into v_candidates
    from public.match_roster_internal(m.id) r
    where r.is_starter and r.user_id <> v_uid;
  end if;

  -- Solo después del cierre, y solo los ganadores (sin conteos).
  if v_is_closed then
    with counts as (
      select candidate_id, count(*) as n from public.mvp_votes where match_id = m.id group by candidate_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'user_id', c.candidate_id,
             'display_name', coalesce(p.nickname, p.first_name, 'Jugador')
           ) order by coalesce(p.nickname, p.first_name)), '[]'::jsonb)
      into v_mvp
    from counts c
    left join public.profiles p on p.id = c.candidate_id
    where c.n = (select max(n) from counts);
  end if;

  return jsonb_build_object(
    'result', jsonb_build_object(
      'loaded', m.result_loaded_at is not null,
      'team_a_goals', m.team_a_goals,
      'team_b_goals', m.team_b_goals
    ),
    'scorers', v_scorers,
    'voting', jsonb_build_object(
      'opens_at', w.opens_at,
      'closes_at', w.closes_at,
      'is_open', v_is_open,
      'is_closed', v_is_closed,
      'is_starter', coalesce(v_my_starter, false),
      'has_voted', v_has_voted,
      'can_vote', v_can_vote,
      'candidates', v_candidates
    ),
    'mvp', v_mvp
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke execute on function public.mvp_voting_window(public.matches)            from public, anon, authenticated;
revoke execute on function public.save_result(uuid, integer, integer, jsonb)   from public, anon;
revoke execute on function public.cast_mvp_vote(uuid, uuid)                    from public, anon;
revoke execute on function public.get_match_post(uuid)                         from public, anon;

grant execute on function public.save_result(uuid, integer, integer, jsonb)    to authenticated;
grant execute on function public.cast_mvp_vote(uuid, uuid)                     to authenticated;
grant execute on function public.get_match_post(uuid)                          to authenticated;
