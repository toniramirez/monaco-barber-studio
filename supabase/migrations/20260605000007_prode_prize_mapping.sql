-- Prode Mundial — premios configurables desde el panel (ADITIVO, prod-safe).
--
-- Hoy las 3 funciones de premiación resuelven la recompensa por NOMBRE
-- hardcodeado. Esta migración las hace leer un mapeo opcional desde
-- prode_tournament.settings:
--   settings.weekly_reward_id  -> premio semanal
--   settings.grand_reward_id   -> gran premio
--   settings.welcome_reward_id -> cupón de bienvenida
--
-- 100% backward-compatible: si el mapeo no está (o apunta a una recompensa
-- inactiva/borrada), se cae al lookup por nombre histórico. Solo cambia la
-- línea de resolución de la recompensa en cada función; el resto es idéntico
-- a lo deployado. `create or replace` => idempotente y reversible.

-- ===== Premio semanal =====
create or replace function public.prode_award_weekly_prizes(p_tournament_id uuid, p_week_start date, p_week_end date)
returns json
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

  -- Recompensa: mapeo configurable (settings.weekly_reward_id) con fallback al nombre histórico.
  select id into v_reward_id from reward_catalog
    where organization_id = v_org and is_active
      and id = (select (settings->>'weekly_reward_id')::uuid from prode_tournament where id = p_tournament_id) limit 1;
  if v_reward_id is null then
    select id into v_reward_id from reward_catalog
      where organization_id = v_org and is_active and name = 'Mundial: Servicio Gratis (Semanal)' limit 1;
  end if;

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
$function$;

-- ===== Gran premio =====
create or replace function public.prode_award_grand_prize(p_tournament_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

  -- Recompensa: mapeo configurable (settings.grand_reward_id) con fallback al nombre histórico.
  select id into v_reward_id from reward_catalog
    where organization_id = v_org and is_active
      and id = (v_settings->>'grand_reward_id')::uuid limit 1;
  if v_reward_id is null then
    select id into v_reward_id from reward_catalog
      where organization_id = v_org and is_active and name = 'Mundial: Gran Premio' limit 1;
  end if;

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
$function$;

-- ===== Cupón de bienvenida (al verificar y registrar) =====
create or replace function public.prode_verify_and_register(p_phone text, p_first_name text, p_last_name text, p_code text)
returns json
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_org uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
  v_norm text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  v_otp prode_otp%rowtype;
  v_client_id uuid; v_tournament uuid := prode_current_tournament();
  v_participant_id uuid; v_display text; v_reward_id uuid; v_client_reward_id uuid; v_is_new boolean := false;
begin
  if v_tournament is null then return json_build_object('ok', false, 'error', 'Torneo no configurado'); end if;
  select * into v_otp from prode_otp where phone=v_norm and consumed_at is null and expires_at>now() order by created_at desc limit 1;
  if v_otp.id is null then return json_build_object('ok', false, 'error', 'Código vencido. Pedí uno nuevo.'); end if;
  update prode_otp set attempts=attempts+1 where id=v_otp.id;
  if v_otp.attempts >= 5 then return json_build_object('ok', false, 'error', 'Demasiados intentos.'); end if;
  if v_otp.code_hash <> encode(digest(v_norm||':'||coalesce(p_code,''),'sha256'),'hex') then
    return json_build_object('ok', false, 'error', 'Código incorrecto');
  end if;
  update prode_otp set consumed_at=now() where id=v_otp.id;

  v_display := initcap(trim(coalesce(p_first_name,'')))
    || case when coalesce(trim(p_last_name),'')<>'' then ' '||upper(left(trim(p_last_name),1))||'.' else '' end;
  if trim(v_display)='' then v_display := 'Jugador'; end if;

  select id into v_client_id from clients where organization_id=v_org and phone=v_norm limit 1;
  if v_client_id is null then
    begin
      insert into clients(organization_id, phone, name)
      values (v_org, v_norm, nullif(trim(coalesce(p_first_name,'')||' '||coalesce(p_last_name,'')),''))
      returning id into v_client_id;
      v_is_new := true;
    exception when unique_violation then
      select id into v_client_id from clients where organization_id=v_org and phone=v_norm limit 1;
    end;
  end if;
  if v_client_id is null then return json_build_object('ok', false, 'error', 'No se pudo crear el cliente'); end if;

  select id into v_participant_id from prode_participants where tournament_id=v_tournament and client_id=v_client_id;
  if v_participant_id is null then
    insert into prode_participants(client_id, tournament_id, display_name, last_name, phone_verified_at)
    values (v_client_id, v_tournament, v_display, nullif(trim(coalesce(p_last_name,'')),''), now())
    returning id into v_participant_id;
  else
    update prode_participants set phone_verified_at=now(), display_name=v_display, updated_at=now() where id=v_participant_id;
  end if;

  insert into prode_league_members(league_id, participant_id)
  select l.id, v_participant_id from prode_leagues l where l.tournament_id=v_tournament and l.is_house
  on conflict (league_id, participant_id) do nothing;

  select welcome_reward_id into v_client_reward_id from prode_participants where id=v_participant_id;
  if v_client_reward_id is null then
    -- Recompensa: mapeo configurable (settings.welcome_reward_id) con fallback al nombre histórico.
    select id into v_reward_id from reward_catalog
      where organization_id=v_org and is_active
        and id=(select (settings->>'welcome_reward_id')::uuid from prode_tournament where id=v_tournament) limit 1;
    if v_reward_id is null then
      select id into v_reward_id from reward_catalog where organization_id=v_org and is_active and name='Cupón Mundial: Bienvenida' limit 1;
    end if;
    if v_reward_id is not null then
      insert into client_rewards(client_id, reward_id, status, source, organization_id)
      values (v_client_id, v_reward_id, 'available', 'manual', v_org)
      returning id into v_client_reward_id;
      update prode_participants set welcome_reward_id=v_client_reward_id where id=v_participant_id;
    end if;
  end if;

  return json_build_object('ok', true, 'participant_id', v_participant_id, 'client_id', v_client_id,
    'is_new', v_is_new, 'display_name', v_display, 'welcome_reward_id', v_client_reward_id);
end;
$function$;
