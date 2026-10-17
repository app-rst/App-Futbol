-- =============================================================================
-- Nombres de equipo: el admin puede ponerle nombre a cada equipo (ej. "Claro" y
-- "Oscuro"). Si no lo hace, la app muestra "Equipo A" / "Equipo B".
-- =============================================================================

alter table public.matches
  add column team_a_name text check (char_length(team_a_name) between 1 and 30),
  add column team_b_name text check (char_length(team_b_name) between 1 and 30);

-- Vacío = sin nombre. Se puede renombrar aunque ya esté cargado el resultado.
create function public.set_team_names(p_match_id uuid, p_team_a_name text, p_team_b_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  m public.matches;
  v_a text := nullif(btrim(p_team_a_name), '');
  v_b text := nullif(btrim(p_team_b_name), '');
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión' using errcode = '42501';
  end if;
  if not public.is_match_participant(p_match_id, v_uid) then
    raise exception 'El partido no existe' using errcode = 'P0002';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if m.admin_id <> v_uid then
    raise exception 'Solo el admin del partido puede ponerle nombre a los equipos' using errcode = '42501';
  end if;
  if m.status = 'cancelled' then
    raise exception 'El partido está cancelado' using errcode = 'P0001';
  end if;
  if char_length(v_a) > 30 or char_length(v_b) > 30 then
    raise exception 'El nombre del equipo puede tener hasta 30 caracteres' using errcode = 'P0001';
  end if;
  if lower(v_a) = lower(v_b) then
    raise exception 'Los dos equipos no pueden tener el mismo nombre' using errcode = 'P0001';
  end if;

  update public.matches set team_a_name = v_a, team_b_name = v_b where id = m.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_match_view: mismo cuerpo que en 20261016000006 + nombres de equipo.
-- -----------------------------------------------------------------------------
create or replace function public.get_match_view(p_match_id uuid default null, p_invite_code text default null)
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
  v_cancel_reason text;
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

  v_cancel_reason := public.cancel_block_reason(m, v_uid, v_sys);

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
      'result_loaded_at', m.result_loaded_at,
      'team_a_name', m.team_a_name,
      'team_b_name', m.team_b_name
    ),
    'players_count', v_count,
    'roster', v_roster,
    'viewer', jsonb_build_object(
      'is_admin', m.admin_id = v_uid,
      'is_participant', v_is_participant,
      'is_system_admin', v_sys,
      'position', v_my_position,
      'is_starter', v_my_position is not null and v_my_position <= m.starters_count,
      'can_duplicate', m.admin_id = v_uid or m.created_by = v_uid,
      'can_cancel', v_cancel_reason is null,
      -- Solo se informa a quien podría cancelar (admin o admin del sistema).
      'cancel_block_reason', case when m.admin_id = v_uid or v_sys then v_cancel_reason end
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- my_history: mismo cuerpo que en 20261016000008 + nombres de equipo.
-- -----------------------------------------------------------------------------
create or replace function public.my_history()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión' using errcode = '42501';
  end if;

  with played as (
    -- Partidos terminados y no cancelados donde fui titular (rol derivado del orden).
    select m.*, r.team as my_team
    from public.matches m
    cross join lateral public.match_roster_internal(m.id) r
    where r.user_id = v_uid
      and r.is_starter
      and m.status = 'open'
      and m.ends_at <= now()
    order by m.starts_at desc
    limit 100
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', pl.id,
           'location', pl.location,
           'starts_at', pl.starts_at,
           'ends_at', pl.ends_at,
           'my_team', pl.my_team,
           'team_names', jsonb_build_object('A', pl.team_a_name, 'B', pl.team_b_name),
           'result', jsonb_build_object(
             'loaded', pl.result_loaded_at is not null,
             'team_a_goals', pl.team_a_goals,
             'team_b_goals', pl.team_b_goals
           ),
           'teams', jsonb_build_object(
             'A', (select coalesce(jsonb_agg(r.display_name order by r."position"), '[]'::jsonb)
                   from public.match_roster_internal(pl.id) r where r.is_starter and r.team = 'A'),
             'B', (select coalesce(jsonb_agg(r.display_name order by r."position"), '[]'::jsonb)
                   from public.match_roster_internal(pl.id) r where r.is_starter and r.team = 'B')
           ),
           'scorers', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'display_name', coalesce(p.nickname, p.first_name, 'Jugador'),
                      'team', mp.team,
                      'goals', s.goals
                    ) order by s.goals desc, coalesce(p.nickname, p.first_name)), '[]'::jsonb)
             from public.match_scorers s
             left join public.profiles p on p.id = s.user_id
             left join public.match_players mp on mp.match_id = s.match_id and mp.user_id = s.user_id
             where s.match_id = pl.id
           ),
           -- null mientras la votación (24 h desde el fin) sigue abierta.
           'mvp', case when now() >= pl.ends_at + interval '24 hours'
                       then (select coalesce(jsonb_agg(w - 'user_id'), '[]'::jsonb)
                             from jsonb_array_elements(public.match_mvp_winners(pl.id)) w)
                  end
         ) order by pl.starts_at desc), '[]'::jsonb)
    into v_result
  from played pl;

  return v_result;
end;
$$;

revoke execute on function public.set_team_names(uuid, text, text) from public, anon;
grant execute on function public.set_team_names(uuid, text, text) to authenticated;
