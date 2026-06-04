-- Prode Mundial 2026 — fixes del review (ADITIVO). Org Monaco a0eebc99-...
-- Aplicado a producción vía MCP el 2026-06-03.
-- 1) tie-break determinista en el ranking semanal (created_at antes que el uuid)
-- 2) prode_award_last_week recorre TODAS las semanas completas sin premiar (robusto p/ cron)
-- 3) prode_share_card: 1 sola RPC para la placa OG (evita ~5 round-trips por render)
-- 4) pin search_path en redeem_reward_by_qr (hardening pre-existente)

-- ===== 1) Ranking semanal con tie-break por antigüedad =====
create or replace function prode_weekly_leaderboard(
  p_tournament_id uuid, p_week_start date, p_week_end date, p_limit int default 100
) returns table(rank bigint, participant_id uuid, display_name text, week_points int, exact_hits int)
language sql stable security definer set search_path = public, pg_temp as $$
  with base as (
    select p.id, p.display_name, p.created_at,
      coalesce((
        select sum(coalesce(mp.points_awarded,0))::int
        from prode_match_predictions mp
        join prode_matches m on m.id = mp.match_id
        where mp.participant_id = p.id
          and m.status = 'finished'
          and (m.kickoff_at at time zone 'America/Argentina/Buenos_Aires')::date between p_week_start and p_week_end
      ),0) as week_points,
      coalesce((
        select count(*)::int
        from prode_match_predictions mp
        join prode_matches m on m.id = mp.match_id
        where mp.participant_id = p.id and mp.is_exact
          and m.status = 'finished'
          and (m.kickoff_at at time zone 'America/Argentina/Buenos_Aires')::date between p_week_start and p_week_end
      ),0) as exact_hits
    from prode_participants p
    where p.tournament_id = p_tournament_id
  )
  select row_number() over (order by week_points desc, exact_hits desc, created_at asc, id),
         id, display_name, week_points, exact_hits
  from base
  order by week_points desc, exact_hits desc, created_at asc, id
  limit greatest(p_limit, 1);
$$;

-- ===== 2) Premiar TODAS las semanas completas sin premiar (idempotente). Para un cron desatendido =====
create or replace function prode_award_last_week(p_tournament_id uuid)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tz constant text := 'America/Argentina/Buenos_Aires';
  v_today date := (now() at time zone v_tz)::date;
  v_this_monday date := v_today - (extract(isodow from v_today)::int - 1);
  v_start date;
  v_week_start date;
  v_end date;
  v_one json;
  v_results json[] := '{}';
  v_awarded int := 0;
begin
  select (starts_at at time zone v_tz)::date into v_start from prode_tournament where id = p_tournament_id;
  if v_start is null then return json_build_object('ok', false, 'error', 'Torneo no encontrado'); end if;

  -- lunes de la semana del arranque del torneo
  v_week_start := v_start - (extract(isodow from v_start)::int - 1);

  -- recorrer cada semana cuyo domingo ya pasó (week_start < lunes de esta semana)
  while v_week_start < v_this_monday loop
    v_end := v_week_start + 6;
    v_one := prode_award_weekly_prizes(p_tournament_id, v_week_start, v_end);
    if (v_one->>'winner') is not null or coalesce((v_one->>'already')::boolean, false) then
      v_awarded := v_awarded + 1;
    end if;
    v_results := v_results || v_one;
    v_week_start := v_week_start + 7;
  end loop;

  return json_build_object('ok', true, 'weeks_processed', coalesce(array_length(v_results, 1), 0),
    'awarded', v_awarded, 'detail', to_json(v_results));
end;
$$;

-- ===== 3) Placa OG en una sola RPC (nombre + puntos + campeón elegido) =====
create or replace function prode_share_card(p_participant_id uuid)
returns json language sql stable security definer set search_path = public, pg_temp as $$
  with p as (
    select id, display_name, tournament_id from prode_participants where id = p_participant_id
  ),
  champ_q as (
    select q.id from prode_questions q join p on p.tournament_id = q.tournament_id where q.kind = 'champion' limit 1
  ),
  champ as (
    select t.id, t.name, t.short_name, t.code, t.flag_url
    from prode_question_predictions qp
    join champ_q cq on cq.id = qp.question_id
    join prode_teams t on t.id::text = qp.answer
    where qp.participant_id = p_participant_id
    limit 1
  )
  select case when (select id from p) is null then null else json_build_object(
    'display_name', (select display_name from p),
    'total_points', (
      coalesce((select sum(coalesce(points_awarded,0)) from prode_question_predictions where participant_id = p_participant_id), 0)
      + coalesce((select sum(coalesce(points_awarded,0)) from prode_match_predictions where participant_id = p_participant_id), 0)
    )::int,
    'champion', (
      select case when champ.name is null then null
        else json_build_object('id', champ.id, 'name', champ.name, 'short_name', champ.short_name, 'code', champ.code, 'flag_url', champ.flag_url)
      end from champ
    )
  ) end;
$$;

-- ===== 4) Hardening pre-existente: pin search_path en redeem_reward_by_qr =====
alter function public.redeem_reward_by_qr(text) set search_path = public, pg_temp;

-- ===== Seguridad: revocar EXECUTE de public/anon/authenticated en funciones prode_*; solo service_role =====
do $$ declare f text; begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'prode\_%' escape '\'
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('revoke all on function %s from anon;', f);
    execute format('revoke all on function %s from authenticated;', f);
    execute format('grant execute on function %s to service_role;', f);
  end loop;
end $$;
