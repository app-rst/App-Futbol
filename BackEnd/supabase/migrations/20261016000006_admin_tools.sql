-- =============================================================================
-- Herramientas del admin del partido (Etapa 4)
-- -----------------------------------------------------------------------------
-- - cancel_match: el admin puede cancelar en cualquier momento antes del inicio
--   EXCEPTO cuando la lista de titulares está completa. Si alguien se baja y no
--   hay suplentes que lo reemplacen, la cancelación vuelve a estar habilitada.
--   El admin del sistema puede cancelar igual (moderación, queda en el log).
-- - transfer_admin_and_leave: el admin solo puede bajarse eligiendo antes a
--   otro TITULAR como nuevo admin; ambas cosas pasan en la misma transacción.
-- - set_teams: el admin arma los dos equipos asignando cada titular a A o B.
-- =============================================================================

-- Motivo por el que NO se puede cancelar (null = se puede). Una sola fuente de
-- verdad para cancel_match y para la UI (get_match_view).
create function public.cancel_block_reason(m public.matches, p_uid uuid, p_sys boolean)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if m.status = 'cancelled' then
    return 'El partido ya está cancelado';
  end if;
  if m.starts_at <= now() then
    return 'El partido ya empezó: no se puede cancelar';
  end if;
  if m.admin_id = p_uid then
    select count(*) into v_count from public.match_players where match_id = m.id;
    if v_count >= m.starters_count then
      return 'La lista de titulares está completa: no se puede cancelar. Se habilita si alguien se baja y no hay suplentes que lo reemplacen.';
    end if;
    return null;
  end if;
  if p_sys then
    return null; -- moderación: sin la restricción de la lista completa
  end if;
  return 'Solo el admin del partido puede cancelarlo';
end;
$$;

-- -----------------------------------------------------------------------------
-- Cancelar
-- -----------------------------------------------------------------------------
create function public.cancel_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_sys boolean := public.is_system_admin();
  m public.matches;
  v_reason text;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión' using errcode = '42501';
  end if;
  if not v_sys and not public.is_match_participant(p_match_id, v_uid) then
    raise exception 'El partido no existe' using errcode = 'P0002';
  end if;

  -- Bloqueo: nadie puede anotarse/bajarse mientras se evalúa la regla.
  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'El partido no existe' using errcode = 'P0002';
  end if;

  v_reason := public.cancel_block_reason(m, v_uid, v_sys);
  if v_reason is not null then
    raise exception '%', v_reason using errcode = case when m.admin_id = v_uid or v_sys then 'P0001' else '42501' end;
  end if;

  update public.matches set status = 'cancelled', cancelled_at = now() where id = m.id;

  if m.admin_id <> v_uid then
    insert into public.admin_audit_log (admin_id, action, target_match_id)
    values (v_uid, 'match.cancel', m.id);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Pasar el admin a otro titular y bajarse
-- -----------------------------------------------------------------------------
create function public.transfer_admin_and_leave(p_match_id uuid, p_new_admin uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  m public.matches;
  s record;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión' using errcode = '42501';
  end if;
  if not public.is_match_participant(p_match_id, v_uid) then
    raise exception 'El partido no existe' using errcode = 'P0002';
  end if;

  m := public.lock_open_match(p_match_id);

  if m.admin_id <> v_uid then
    raise exception 'Solo el admin del partido puede pasar el admin' using errcode = '42501';
  end if;
  if p_new_admin = v_uid then
    raise exception 'Elegí a otro jugador como nuevo admin' using errcode = 'P0001';
  end if;

  select * into s from public.player_slot(m.id, p_new_admin);
  if s."position" is null then
    raise exception 'Ese jugador no está anotado en el partido' using errcode = 'P0001';
  end if;
  if not s.is_starter then
    raise exception 'El nuevo admin tiene que ser un titular' using errcode = 'P0001';
  end if;
  if public.is_blocked(p_new_admin) then
    raise exception 'Ese jugador no puede ser admin (cuenta suspendida)' using errcode = 'P0001';
  end if;

  -- Ambas cosas en la misma transacción: nunca queda un partido sin admin.
  update public.matches set admin_id = p_new_admin where id = m.id;
  delete from public.match_players where match_id = m.id and user_id = v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Armar equipos: p_assignments = [{"user_id": "...", "team": "A" | "B" | null}, ...]
-- Permitido hasta que se carga el resultado (también después del inicio).
-- -----------------------------------------------------------------------------
create function public.set_teams(p_match_id uuid, p_assignments jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  m public.matches;
  a jsonb;
  v_user uuid;
  v_team text;
  s record;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión' using errcode = '42501';
  end if;
  if not public.is_match_participant(p_match_id, v_uid) then
    raise exception 'El partido no existe' using errcode = 'P0002';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if m.admin_id <> v_uid then
    raise exception 'Solo el admin del partido puede armar los equipos' using errcode = '42501';
  end if;
  if m.status = 'cancelled' then
    raise exception 'El partido está cancelado' using errcode = 'P0001';
  end if;
  if m.result_loaded_at is not null then
    raise exception 'Ya se cargó el resultado: los equipos no se pueden cambiar' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_assignments) is distinct from 'array' then
    raise exception 'Formato inválido' using errcode = 'P0001';
  end if;

  for a in select * from jsonb_array_elements(p_assignments) loop
    v_user := (a ->> 'user_id')::uuid;
    v_team := nullif(a ->> 'team', '');
    if v_team is not null and v_team not in ('A', 'B') then
      raise exception 'Equipo inválido: tiene que ser A o B' using errcode = 'P0001';
    end if;
    select * into s from public.player_slot(m.id, v_user);
    if s."position" is null then
      raise exception 'Uno de los jugadores no está anotado en el partido' using errcode = 'P0001';
    end if;
    if not s.is_starter and v_team is not null then
      raise exception 'Solo los titulares pueden estar en un equipo' using errcode = 'P0001';
    end if;
    update public.match_players set team = v_team where match_id = m.id and user_id = v_user;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_match_view: suma si el que mira puede cancelar (y por qué no).
-- Mismo cuerpo que en 20261016000004 + can_cancel / cancel_block_reason.
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
      'can_duplicate', m.admin_id = v_uid or m.created_by = v_uid,
      'can_cancel', v_cancel_reason is null,
      -- Solo se informa a quien podría cancelar (admin o admin del sistema).
      'cancel_block_reason', case when m.admin_id = v_uid or v_sys then v_cancel_reason end
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke execute on function public.cancel_block_reason(public.matches, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.cancel_match(uuid)                          from public, anon;
revoke execute on function public.transfer_admin_and_leave(uuid, uuid)        from public, anon;
revoke execute on function public.set_teams(uuid, jsonb)                      from public, anon;

grant execute on function public.cancel_match(uuid)                           to authenticated;
grant execute on function public.transfer_admin_and_leave(uuid, uuid)         to authenticated;
grant execute on function public.set_teams(uuid, jsonb)                       to authenticated;
