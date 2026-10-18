-- =============================================================================
-- Resultado fijo: una vez guardado, el marcador (goles de A y de B) no se
-- puede cambiar. Los goleadores se pueden seguir corrigiendo, siempre que no
-- sumen más goles que el marcador guardado.
-- =============================================================================

create or replace function public.save_result(
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
  if m.result_loaded_at is not null
     and (p_team_a_goals <> m.team_a_goals or p_team_b_goals <> m.team_b_goals) then
    raise exception 'El resultado ya está guardado: solo podés corregir los goleadores' using errcode = 'P0001';
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
         result_loaded_at = coalesce(m.result_loaded_at, now())
   where id = m.id;
end;
$$;

revoke execute on function public.save_result(uuid, integer, integer, jsonb) from public, anon;
grant execute on function public.save_result(uuid, integer, integer, jsonb) to authenticated;
