-- =============================================================================
-- Historial (Etapa 6)
-- -----------------------------------------------------------------------------
-- Cada usuario ve los partidos en los que participó: fecha, lugar, equipos,
-- resultado, goleadores y MVP. "Participó" = fue TITULAR (los suplentes no
-- jugaron), el partido no está cancelado y ya terminó.
-- =============================================================================

-- Ganadores del MVP (todos si hay empate, [] si nadie votó). Sin conteos.
-- Uso interno: quien llama decide si la votación ya cerró.
create function public.match_mvp_winners(p_match_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with counts as (
    select candidate_id, count(*) as n
    from public.mvp_votes
    where match_id = p_match_id
    group by candidate_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', c.candidate_id,
           'display_name', coalesce(p.nickname, p.first_name, 'Jugador')
         ) order by coalesce(p.nickname, p.first_name)), '[]'::jsonb)
  from counts c
  left join public.profiles p on p.id = c.candidate_id
  where c.n = (select max(n) from counts);
$$;

-- get_match_post: mismo comportamiento que en 20261016000007, ahora usando
-- match_mvp_winners (una sola fuente de verdad para el MVP).
create or replace function public.get_match_post(p_match_id uuid)
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
    -- Solo después del cierre, y solo los ganadores.
    'mvp', case when v_is_closed then public.match_mvp_winners(m.id) end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Mi historial
-- -----------------------------------------------------------------------------
create function public.my_history()
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

revoke execute on function public.match_mvp_winners(uuid) from public, anon, authenticated;
revoke execute on function public.my_history()            from public, anon;
grant execute on function public.my_history()             to authenticated;
