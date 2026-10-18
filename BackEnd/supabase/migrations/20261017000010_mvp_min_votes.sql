-- =============================================================================
-- MVP con mínimo de votos: hay MVP solo si votó al menos la mitad de los
-- titulares del partido (redondeando para arriba: 5 de 10, 8 de 15). Si no se
-- llega, el partido queda sin MVP ([]). Sigue sin exponer conteos.
-- =============================================================================

create or replace function public.match_mvp_winners(p_match_id uuid)
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
  where c.n = (select max(n) from counts)
    and (select coalesce(sum(n), 0) from counts) >= (
      select ceil(m.starters_count / 2.0) from public.matches m where m.id = p_match_id
    );
$$;

revoke execute on function public.match_mvp_winners(uuid) from public, anon, authenticated;
