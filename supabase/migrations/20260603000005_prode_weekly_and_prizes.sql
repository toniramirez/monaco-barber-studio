-- Prode Mundial 2026 — premio semanal + gran premio + lectura de premios del jugador (ADITIVO)
-- Org Monaco: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11. No toca objetos existentes.
-- Ranking por ventana semanal (lun-dom hora ARG), materialización idempotente de client_rewards.
-- Aplicado a producción vía MCP el 2026-06-03.

-- ===== Tabla de premios semanales (idempotencia + auditoría) =====
create table if not exists prode_weekly_prizes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  tournament_id uuid not null references prode_tournament(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  winner_participant_id uuid references prode_participants(id) on delete set null,
  winner_points int,
  client_reward_id uuid references client_rewards(id) on delete set null,
  awarded_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (tournament_id, week_start)
);
create index if not exists idx_prode_weekly_prizes_tournament on prode_weekly_prizes(tournament_id, week_start);

alter table prode_weekly_prizes enable row level security;
-- deny-all (sin policy): solo accesible vía service-role / RPCs SECURITY DEFINER (igual que el resto del prode).

-- ===== Ranking semanal: puntos de predicciones de PARTIDOS cuyo kickoff (ARG) cae en [week_start, week_end] =====
create or replace function prode_weekly_leaderboard(
  p_tournament_id uuid, p_week_start date, p_week_end date, p_limit int default 100
) returns table(rank bigint, participant_id uuid, display_name text, week_points int, exact_hits int)
language sql stable security definer set search_path = public, pg_temp as $$
  with base as (
    select p.id, p.display_name,
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
  select row_number() over (order by week_points desc, exact_hits desc, id), id, display_name, week_points, exact_hits
  from base
  order by week_points desc, exact_hits desc, id
  limit greatest(p_limit, 1);
$$;

-- ===== Premiar la semana [week_start, week_end] (idempotente por unique(tournament, week_start)) =====
create or replace function prode_award_weekly_prizes(p_tournament_id uuid, p_week_start date, p_week_end date)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
  v_existing prode_weekly_prizes%rowtype;
  v_winner record;
  v_client_id uuid;
  v_reward_id uuid;
  v_client_reward_id uuid;
begin
  if p_tournament_id is null or p_week_start is null or p_week_end is null then
    return json_build_object('ok', false, 'error', 'Parámetros inválidos');
  end if;

  select * into v_existing from prode_weekly_prizes where tournament_id = p_tournament_id and week_start = p_week_start;
  if v_existing.id is not null then
    return json_build_object('ok', true, 'already', true, 'week_start', p_week_start, 'week_end', p_week_end,
      'winner_participant_id', v_existing.winner_participant_id, 'winner_points', v_existing.winner_points,
      'client_reward_id', v_existing.client_reward_id);
  end if;

  select wl.participant_id, wl.display_name, wl.week_points
    into v_winner
  from prode_weekly_leaderboard(p_tournament_id, p_week_start, p_week_end, 1) wl limit 1;

  if v_winner.participant_id is null or coalesce(v_winner.week_points, 0) <= 0 then
    -- Sin puntos esta semana: NO insertamos (se puede reintentar cuando haya resultados). Sin reward.
    return json_build_object('ok', true, 'winner', null, 'week_start', p_week_start, 'week_end', p_week_end,
      'reason', 'Sin puntos en la semana todavía');
  end if;

  select client_id into v_client_id from prode_participants where id = v_winner.participant_id;
  select id into v_reward_id from reward_catalog
    where organization_id = v_org and is_active and name = 'Mundial: Servicio Gratis (Semanal)' limit 1;

  if v_client_id is not null and v_reward_id is not null then
    insert into client_rewards(client_id, reward_id, status, source, organization_id, expires_at)
    values (v_client_id, v_reward_id, 'available', 'milestone_free', v_org, '2026-08-31 23:59:00+00')
    returning id into v_client_reward_id;
  end if;

  insert into prode_weekly_prizes(organization_id, tournament_id, week_start, week_end, winner_participant_id, winner_points, client_reward_id)
  values (v_org, p_tournament_id, p_week_start, p_week_end, v_winner.participant_id, v_winner.week_points, v_client_reward_id);

  return json_build_object('ok', true, 'winner', json_build_object(
    'participant_id', v_winner.participant_id, 'display_name', v_winner.display_name,
    'client_id', v_client_id, 'points', v_winner.week_points, 'client_reward_id', v_client_reward_id),
    'week_start', p_week_start, 'week_end', p_week_end);
end;
$$;

-- ===== Premiar la última semana completa (lun-dom ARG) — pensado para el cron semanal =====
create or replace function prode_award_last_week(p_tournament_id uuid)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tz constant text := 'America/Argentina/Buenos_Aires';
  v_today date := (now() at time zone v_tz)::date;
  v_this_monday date := v_today - (extract(isodow from v_today)::int - 1);
  v_last_monday date := v_this_monday - 7;
  v_last_sunday date := v_this_monday - 1;
begin
  return prode_award_weekly_prizes(p_tournament_id, v_last_monday, v_last_sunday);
end;
$$;

-- ===== Gran premio: al campeón general del torneo (idempotente vía settings) =====
create or replace function prode_award_grand_prize(p_tournament_id uuid)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
  v_settings jsonb;
  v_winner record;
  v_client_id uuid;
  v_reward_id uuid;
  v_client_reward_id uuid;
begin
  select settings into v_settings from prode_tournament where id = p_tournament_id;
  if v_settings is null then return json_build_object('ok', false, 'error', 'Torneo no encontrado'); end if;
  if (v_settings->>'grand_prize_awarded_at') is not null then
    return json_build_object('ok', true, 'already', true,
      'winner_participant_id', v_settings->>'grand_prize_participant_id',
      'client_reward_id', v_settings->>'grand_prize_client_reward_id');
  end if;

  select lb.participant_id, lb.display_name, lb.total_points
    into v_winner
  from prode_public_leaderboard(p_tournament_id, null, 1) lb limit 1;

  if v_winner.participant_id is null or coalesce(v_winner.total_points, 0) <= 0 then
    return json_build_object('ok', false, 'error', 'No hay ganador con puntos todavía');
  end if;

  select client_id into v_client_id from prode_participants where id = v_winner.participant_id;
  select id into v_reward_id from reward_catalog
    where organization_id = v_org and is_active and name = 'Mundial: Gran Premio' limit 1;

  if v_client_id is not null and v_reward_id is not null then
    insert into client_rewards(client_id, reward_id, status, source, organization_id, expires_at)
    values (v_client_id, v_reward_id, 'available', 'manual', v_org, '2026-08-31 23:59:00+00')
    returning id into v_client_reward_id;
  end if;

  update prode_tournament set
    status = 'finished',
    settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
      'grand_prize_awarded_at', now(),
      'grand_prize_participant_id', v_winner.participant_id,
      'grand_prize_client_reward_id', v_client_reward_id),
    updated_at = now()
  where id = p_tournament_id;

  return json_build_object('ok', true, 'winner', json_build_object(
    'participant_id', v_winner.participant_id, 'display_name', v_winner.display_name,
    'client_id', v_client_id, 'points', v_winner.total_points, 'client_reward_id', v_client_reward_id));
end;
$$;

-- ===== Premios del jugador (welcome / semanal / gran premio) para la pantalla "Mis premios" =====
create or replace function prode_my_rewards(p_participant_id uuid)
returns json language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(json_agg(json_build_object(
    'client_reward_id', cr.id,
    'name', rc.name,
    'description', rc.description,
    'discount_pct', rc.discount_pct,
    'is_free_service', rc.is_free_service,
    'status', cr.status,
    'qr_code', cr.qr_code,
    'expires_at', cr.expires_at,
    'created_at', cr.created_at
  ) order by case cr.status when 'available' then 0 when 'redeemed' then 1 else 2 end, cr.created_at desc), '[]'::json)
  from prode_participants p
  join client_rewards cr on cr.client_id = p.client_id and cr.organization_id = p.organization_id
  join reward_catalog rc on rc.id = cr.reward_id
  where p.id = p_participant_id
    and rc.name ilike '%Mundial%';
$$;

-- ===== Seguridad: revocar EXECUTE de public/anon/authenticated en TODAS las funciones prode_*; solo service_role =====
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
