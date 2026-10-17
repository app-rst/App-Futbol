-- =============================================================================
-- "Despertador": consulta mínima para que el proyecto gratuito de Supabase
-- registre actividad y no se pause tras 1 semana sin uso. La llama una vez
-- por día un Cron de Vercel (FrontEnd/app/api/keepalive). No expone datos.
-- =============================================================================

create function public.ping()
returns boolean
language sql
stable
set search_path = ''
as $$
  select true;
$$;

revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
