-- =============================================================================
-- Inscripción (Etapa 3): anotarse, bajarse y sacar jugadores
-- -----------------------------------------------------------------------------
-- - El jugador no elige el rol: los primeros N inscriptos son titulares y el
--   resto suplentes, por orden de llegada (rol derivado de match_players.seq).
-- - Si un titular se va, el primer suplente pasa a titular automáticamente:
--   el borrado de la fila ya lo "promueve" dentro de la misma transacción.
-- - Todas las funciones bloquean la fila del partido (select … for update), así
--   dos inscripciones o bajas simultáneas sobre el mismo partido se ejecutan de
--   a una y nunca hay más titulares que N ni posiciones duplicadas.
-- - La fecha límite de inscripción es informativa: NO bloquea anotarse.
-- =============================================================================

-- Posición y rol de un usuario en un partido (null si no está inscripto).
create function public.player_slot(p_match_id uuid, p_user_id uuid)
returns table ("position" bigint, is_starter boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select r."position", r.is_starter
  from public.match_roster_internal(p_match_id) r
  where r.user_id = p_user_id;
$$;

-- Bloquea el partido y valida que se pueda modificar la lista (abierto y antes del inicio).
create function public.lock_open_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.matches;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'El partido no existe' using errcode = 'P0002';
  end if;
  if m.status = 'cancelled' then
    raise exception 'El partido está cancelado' using errcode = 'P0001';
  end if;
  if m.starts_at <= now() then
    raise exception 'El partido ya empezó: la lista no se puede modificar' using errcode = 'P0001';
  end if;
  return m;
end;
$$;

-- -----------------------------------------------------------------------------
-- Anotarse desde el link de invitación
-- -----------------------------------------------------------------------------
create function public.join_match_by_code(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_can_play();
  v_match_id uuid;
  m public.matches;
  s record;
begin
  select id into v_match_id from public.matches where invite_code = lower(btrim(p_invite_code));
  if v_match_id is null then
    raise exception 'El partido no existe' using errcode = 'P0002';
  end if;

  m := public.lock_open_match(v_match_id);

  if exists (select 1 from public.match_players where match_id = m.id and user_id = v_uid) then
    raise exception 'Ya estás anotado en este partido' using errcode = 'P0001';
  end if;

  insert into public.match_players (match_id, user_id) values (m.id, v_uid);

  select * into s from public.player_slot(m.id, v_uid);
  return jsonb_build_object('match_id', m.id, 'position', s."position", 'is_starter', s.is_starter);
end;
$$;

-- -----------------------------------------------------------------------------
-- Bajarse (el admin no puede: primero tiene que pasarle el admin a otro titular)
-- -----------------------------------------------------------------------------
create function public.leave_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  m public.matches;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión' using errcode = '42501';
  end if;

  m := public.lock_open_match(p_match_id);

  if m.admin_id = v_uid then
    raise exception 'Sos el admin: antes de bajarte tenés que elegir a otro titular como admin' using errcode = 'P0001';
  end if;

  delete from public.match_players where match_id = m.id and user_id = v_uid;
  if not found then
    raise exception 'No estás anotado en este partido' using errcode = 'P0001';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Sacar a un jugador (admin del partido o admin del sistema)
-- -----------------------------------------------------------------------------
create function public.remove_player(p_match_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_sys boolean := public.is_system_admin();
  m public.matches;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión' using errcode = '42501';
  end if;
  -- Sin acceso al partido, ni siquiera revelamos que existe.
  if not v_sys and not public.is_match_participant(p_match_id, v_uid) then
    raise exception 'El partido no existe' using errcode = 'P0002';
  end if;

  m := public.lock_open_match(p_match_id);

  if m.admin_id <> v_uid and not v_sys then
    raise exception 'Solo el admin del partido puede sacar jugadores' using errcode = '42501';
  end if;
  if p_user_id = m.admin_id then
    raise exception 'No se puede sacar al admin del partido' using errcode = 'P0001';
  end if;

  delete from public.match_players where match_id = m.id and user_id = p_user_id;
  if not found then
    raise exception 'Ese jugador no está anotado en el partido' using errcode = 'P0001';
  end if;

  -- Las acciones de moderación del admin del sistema quedan registradas.
  if m.admin_id <> v_uid then
    insert into public.admin_audit_log (admin_id, action, target_user_id, target_match_id)
    values (v_uid, 'match.remove_player', p_user_id, m.id);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke execute on function public.player_slot(uuid, uuid)        from public, anon, authenticated;
revoke execute on function public.lock_open_match(uuid)          from public, anon, authenticated;
revoke execute on function public.join_match_by_code(text)       from public, anon;
revoke execute on function public.leave_match(uuid)              from public, anon;
revoke execute on function public.remove_player(uuid, uuid)      from public, anon;

grant execute on function public.join_match_by_code(text)        to authenticated;
grant execute on function public.leave_match(uuid)               to authenticated;
grant execute on function public.remove_player(uuid, uuid)       to authenticated;
