-- Prode Mundial — premios por DESAFÍO + bienvenida 25%/48h + podio del Gran Premio.
-- ADITIVO y prod-safe (org Monaco a0eebc99-...). No toca tablas ajenas al prode.
--
-- Contexto: el rediseño "juego" agrupa los partidos en Desafíos (D1/D2/D3 = fechas
-- de grupos; 16vos/8vos = eliminatorias). Cada Desafío premia al 1º de SU tabla.
-- La premiación es MANUAL desde el panel (igual que el premio semanal) — sin crons
-- nuevos (Vercel Hobby).

-- ===== 1) Bienvenida: 20% → 25% =====
update reward_catalog
   set discount_pct = 25, updated_at = now()
 where organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid
   and name = 'Cupón Mundial: Bienvenida';

-- ===== 2) Catálogo de premios por tier (idempotente por nombre) =====
do $$
declare
  v_org uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
  v_until timestamptz := '2026-08-31 23:59:00+00';
  v_name text;
  v_desc text;
  v_rows text[][] := array[
    array['Prode: 1 mes de cortes',            'Un mes de cortes gratis — premio de Desafío del Prode Mundial.'],
    array['Prode: 1 mes de cortes + camiseta', 'Un mes de cortes gratis + camiseta de la selección — premio de Desafío (eliminatorias).'],
    array['Prode: 3 meses de cortes + camiseta','Tres meses de cortes gratis + camiseta — 3º del Gran Premio.'],
    array['Prode: 6 meses de cortes + camiseta','Seis meses de cortes gratis + camiseta — 2º del Gran Premio.'],
    array['Prode: 1 año de cortes + camiseta',  'Un año de cortes gratis + camiseta — 1º del Gran Premio.']
  ];
  i int;
begin
  for i in 1 .. array_length(v_rows, 1) loop
    v_name := v_rows[i][1];
    v_desc := v_rows[i][2];
    if not exists (select 1 from reward_catalog where organization_id = v_org and name = v_name) then
      insert into reward_catalog(organization_id, name, description, type, is_free_service, is_active, valid_until)
      values (v_org, v_name, v_desc, 'manual', true, true, v_until);
    end if;
  end loop;
end $$;

-- ===== 3) Registro de premios por desafío (espeja prode_weekly_prizes) =====
create table if not exists prode_challenge_prizes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  tournament_id uuid not null references prode_tournament(id) on delete cascade,
  challenge_key text not null,                 -- 'group-1' | 'round_of_32' | ...
  stage prode_match_stage not null,
  matchday int,                                -- null en eliminatorias
  winner_participant_id uuid references prode_participants(id) on delete set null,
  winner_points int,
  reward_id uuid,                              -- reward_catalog usado
  client_reward_id uuid,                       -- client_reward otorgado
  awarded_at timestamptz not null default now()
);
create unique index if not exists idx_prode_challenge_prizes_uniq
  on prode_challenge_prizes(tournament_id, challenge_key);
create index if not exists idx_prode_challenge_prizes_tournament
  on prode_challenge_prizes(tournament_id);

-- ===== 4) Leaderboard por desafío (= semanal pero filtrado por stage/matchday) =====
create or replace function public.prode_challenge_leaderboard(
  p_tournament_id uuid, p_stage text, p_matchday int default null, p_limit int default 100
)
returns table(rank bigint, participant_id uuid, display_name text, challenge_points int, exact_hits int)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with base as (
    select p.id, p.display_name, p.created_at,
      coalesce((
        select sum(coalesce(mp.points_awarded,0))::int
        from prode_match_predictions mp
        join prode_matches m on m.id = mp.match_id
        where mp.participant_id = p.id
          and m.status = 'finished'
          and m.stage = p_stage::prode_match_stage
          and (p_matchday is null or m.matchday = p_matchday)
      ),0) as challenge_points,
      coalesce((
        select count(*)::int
        from prode_match_predictions mp
        join prode_matches m on m.id = mp.match_id
        where mp.participant_id = p.id and mp.is_exact
          and m.status = 'finished'
          and m.stage = p_stage::prode_match_stage
          and (p_matchday is null or m.matchday = p_matchday)
      ),0) as exact_hits
    from prode_participants p
    where p.tournament_id = p_tournament_id
  )
  select row_number() over (order by challenge_points desc, exact_hits desc, created_at asc, id),
         id, display_name, challenge_points, exact_hits
  from base
  order by challenge_points desc, exact_hits desc, created_at asc, id
  limit greatest(p_limit, 1);
$function$;

-- ===== 5) Premiar un desafío (1º de su tabla). Idempotente por challenge_key. =====
create or replace function public.prode_award_challenge_prize(
  p_tournament_id uuid, p_challenge_key text, p_stage text, p_matchday int, p_reward_id uuid
)
returns json
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_org uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
  v_existing prode_challenge_prizes%rowtype;
  v_winner record;
  v_client_id uuid;
  v_client_reward_id uuid;
begin
  if p_tournament_id is null or coalesce(p_challenge_key,'') = '' or coalesce(p_stage,'') = '' then
    return json_build_object('ok', false, 'error', 'Parámetros inválidos');
  end if;
  if p_reward_id is null then
    return json_build_object('ok', false, 'error', 'Elegí qué recompensa entregar para este desafío');
  end if;

  select * into v_existing
    from prode_challenge_prizes
   where tournament_id = p_tournament_id and challenge_key = p_challenge_key;
  if v_existing.id is not null then
    return json_build_object('ok', true, 'already', true,
      'winner_participant_id', v_existing.winner_participant_id,
      'winner_points', v_existing.winner_points,
      'client_reward_id', v_existing.client_reward_id);
  end if;

  -- validar recompensa de la org + activa
  perform 1 from reward_catalog where id = p_reward_id and organization_id = v_org and is_active;
  if not found then
    return json_build_object('ok', false, 'error', 'Recompensa inválida o inactiva');
  end if;

  select cl.participant_id, cl.display_name, cl.challenge_points
    into v_winner
  from prode_challenge_leaderboard(p_tournament_id, p_stage, p_matchday, 1) cl limit 1;

  if v_winner.participant_id is null or coalesce(v_winner.challenge_points,0) <= 0 then
    -- Sin puntos todavía: NO insertamos (se puede reintentar cuando haya resultados).
    return json_build_object('ok', true, 'winner', null, 'reason', 'Sin puntos en este desafío todavía');
  end if;

  select client_id into v_client_id from prode_participants where id = v_winner.participant_id;
  if v_client_id is not null then
    insert into client_rewards(client_id, reward_id, status, source, organization_id, expires_at)
    values (v_client_id, p_reward_id, 'available', 'manual', v_org, '2026-08-31 23:59:00+00')
    returning id into v_client_reward_id;
  end if;

  insert into prode_challenge_prizes(organization_id, tournament_id, challenge_key, stage, matchday,
    winner_participant_id, winner_points, reward_id, client_reward_id)
  values (v_org, p_tournament_id, p_challenge_key, p_stage::prode_match_stage, p_matchday,
    v_winner.participant_id, v_winner.challenge_points, p_reward_id, v_client_reward_id);

  return json_build_object('ok', true, 'winner', json_build_object(
    'participant_id', v_winner.participant_id, 'display_name', v_winner.display_name,
    'points', v_winner.challenge_points, 'client_reward_id', v_client_reward_id));
end;
$function$;

-- ===== 6) prode_auth_with_pin: el cupón de bienvenida vence a las 48h =====
create or replace function public.prode_auth_with_pin(p_phone text, p_pin text, p_first_name text default null, p_last_name text default null)
returns json
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_org uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
  v_norm text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  v_tournament uuid := prode_current_tournament();
  v_client_id uuid;
  v_participant_id uuid;
  v_pin_hash text;
  v_display text;
  v_reward_id uuid;
  v_client_reward_id uuid;
  v_is_new boolean := false;
begin
  if v_tournament is null then return json_build_object('ok', false, 'error', 'Torneo no configurado'); end if;
  if length(v_norm) < 8 then return json_build_object('ok', false, 'error', 'Teléfono inválido'); end if;
  if p_pin !~ '^\d{4}$' then return json_build_object('ok', false, 'error', 'El PIN son 4 dígitos'); end if;

  select id into v_client_id from clients where organization_id=v_org and phone=v_norm limit 1;
  if v_client_id is not null then
    select id, pin_hash, display_name
      into v_participant_id, v_pin_hash, v_display
      from prode_participants where tournament_id=v_tournament and client_id=v_client_id;
  end if;

  if v_participant_id is not null then
    if v_pin_hash is null then
      update prode_participants set pin_hash = crypt(p_pin, gen_salt('bf')), updated_at=now()
        where id=v_participant_id;
    elsif crypt(p_pin, v_pin_hash) <> v_pin_hash then
      return json_build_object('ok', false, 'error', 'PIN incorrecto');
    end if;
    return json_build_object('ok', true, 'participant_id', v_participant_id,
      'display_name', v_display, 'is_new', false);
  end if;

  if coalesce(trim(p_first_name),'') = '' then
    return json_build_object('ok', true, 'need_name', true);
  end if;

  v_display := initcap(trim(coalesce(p_first_name,'')))
    || case when coalesce(trim(p_last_name),'')<>'' then ' '||upper(left(trim(p_last_name),1))||'.' else '' end;
  if trim(v_display)='' then v_display := 'Jugador'; end if;

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

  insert into prode_participants(client_id, tournament_id, display_name, last_name, phone_verified_at, pin_hash)
  values (v_client_id, v_tournament, v_display, nullif(trim(coalesce(p_last_name,'')),''), now(), crypt(p_pin, gen_salt('bf')))
  returning id into v_participant_id;

  insert into prode_league_members(league_id, participant_id)
  select l.id, v_participant_id from prode_leagues l where l.tournament_id=v_tournament and l.is_house
  on conflict (league_id, participant_id) do nothing;

  select id into v_reward_id from reward_catalog
    where organization_id=v_org and is_active
      and id=(select (settings->>'welcome_reward_id')::uuid from prode_tournament where id=v_tournament) limit 1;
  if v_reward_id is null then
    select id into v_reward_id from reward_catalog where organization_id=v_org and is_active and name='Cupón Mundial: Bienvenida' limit 1;
  end if;
  if v_reward_id is not null then
    -- Bienvenida: ventana de 48h para canjear (urgencia → primera visita al local).
    insert into client_rewards(client_id, reward_id, status, source, organization_id, expires_at)
    values (v_client_id, v_reward_id, 'available', 'manual', v_org, now() + interval '48 hours')
    returning id into v_client_reward_id;
    update prode_participants set welcome_reward_id=v_client_reward_id where id=v_participant_id;
  end if;

  return json_build_object('ok', true, 'participant_id', v_participant_id,
    'display_name', v_display, 'is_new', true, 'welcome_reward_id', v_client_reward_id);
end;
$function$;

-- ===== 7) Gran Premio: podio 1º/2º/3º (additivo, backward-compat) =====
-- Otorga al 1º (como antes) + 2º/3º SI hay mapeo settings.grand_2nd_reward_id /
-- grand_3rd_reward_id. Marca el torneo finalizado. Idempotente por grand_prize_awarded_at.
create or replace function public.prode_award_grand_prize(p_tournament_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_org uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
  v_settings jsonb;
  v_row record;
  v_client_id uuid;
  v_reward_id uuid;
  v_client_reward_id uuid;
  v_winner_1 uuid; v_winner_1_name text; v_cr_1 uuid;
  v_cr_2 uuid; v_cr_3 uuid;
  v_keys text[] := array['grand_reward_id','grand_2nd_reward_id','grand_3rd_reward_id'];
begin
  select settings into v_settings from prode_tournament where id = p_tournament_id;
  if v_settings is null then return json_build_object('ok', false, 'error', 'Torneo no encontrado'); end if;
  if (v_settings->>'grand_prize_awarded_at') is not null then
    return json_build_object('ok', true, 'already', true,
      'winner_participant_id', v_settings->>'grand_prize_participant_id',
      'client_reward_id', v_settings->>'grand_prize_client_reward_id');
  end if;

  -- Recorremos el top 3 de la tabla general.
  for v_row in
    select lb.rank, lb.participant_id, lb.display_name, lb.total_points
    from prode_public_leaderboard(p_tournament_id, null, 3) lb
    order by lb.rank
  loop
    if coalesce(v_row.total_points,0) <= 0 then continue; end if;

    -- Recompensa mapeada para este puesto (1→grand_reward_id, 2→2nd, 3→3rd).
    v_reward_id := null;
    select id into v_reward_id from reward_catalog
      where organization_id=v_org and is_active
        and id=(v_settings->>v_keys[v_row.rank::int])::uuid limit 1;
    -- 1º: fallback al nombre histórico si no hay mapeo.
    if v_reward_id is null and v_row.rank = 1 then
      select id into v_reward_id from reward_catalog
        where organization_id=v_org and is_active and name='Mundial: Gran Premio' limit 1;
    end if;
    if v_reward_id is null then continue; end if; -- 2º/3º sin mapeo: se saltan

    select client_id into v_client_id from prode_participants where id = v_row.participant_id;
    if v_client_id is null then continue; end if;

    insert into client_rewards(client_id, reward_id, status, source, organization_id, expires_at)
    values (v_client_id, v_reward_id, 'available', 'manual', v_org, '2026-08-31 23:59:00+00')
    returning id into v_client_reward_id;

    if v_row.rank = 1 then v_winner_1 := v_row.participant_id; v_winner_1_name := v_row.display_name; v_cr_1 := v_client_reward_id;
    elsif v_row.rank = 2 then v_cr_2 := v_client_reward_id;
    elsif v_row.rank = 3 then v_cr_3 := v_client_reward_id;
    end if;
  end loop;

  if v_winner_1 is null then
    return json_build_object('ok', false, 'error', 'No hay campeón con puntos todavía');
  end if;

  update prode_tournament set
    status = 'finished',
    settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
      'grand_prize_awarded_at', now(),
      'grand_prize_participant_id', v_winner_1,
      'grand_prize_client_reward_id', v_cr_1,
      'grand_prize_2nd_client_reward_id', v_cr_2,
      'grand_prize_3rd_client_reward_id', v_cr_3),
    updated_at = now()
  where id = p_tournament_id;

  return json_build_object('ok', true, 'winner', json_build_object(
    'participant_id', v_winner_1, 'display_name', v_winner_1_name, 'client_reward_id', v_cr_1),
    'second_client_reward_id', v_cr_2, 'third_client_reward_id', v_cr_3);
end;
$function$;

-- ===== Permisos: solo service_role ejecuta (mismo patrón que el resto del prode) =====
revoke all on function public.prode_challenge_leaderboard(uuid, text, int, int) from public, anon, authenticated;
revoke all on function public.prode_award_challenge_prize(uuid, text, text, int, uuid) from public, anon, authenticated;
grant execute on function public.prode_challenge_leaderboard(uuid, text, int, int) to service_role;
grant execute on function public.prode_award_challenge_prize(uuid, text, text, int, uuid) to service_role;
