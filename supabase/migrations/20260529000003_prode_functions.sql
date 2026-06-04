-- Prode Mundial 2026 — funciones (SECURITY DEFINER). Se ejecutan vía service-role
-- (Server Actions + edge function). Al final se revoca EXECUTE de public/anon/authenticated.

-- Columnas de scoring (aditivo)
alter table prode_match_predictions add column if not exists is_correct boolean;
alter table prode_match_predictions add column if not exists is_exact boolean;

-- Torneo activo de Monaco
create or replace function prode_current_tournament()
returns uuid language sql stable security definer set search_path = public as $$
  select id from prode_tournament
  where organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid
  order by case status when 'active' then 0 when 'upcoming' then 1 else 2 end, starts_at desc
  limit 1;
$$;

-- Pedir OTP (rate-limited). Devuelve el código EN CLARO al server (que lo envía por
-- WhatsApp). La DB guarda solo el hash. NO se expone a anon.
create or replace function prode_request_otp(p_phone text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_norm text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g'); v_allowed boolean; v_code text;
begin
  if length(v_norm) < 8 then return json_build_object('ok', false, 'error', 'Teléfono inválido'); end if;
  select allowed into v_allowed from check_rate_limit('prode_otp', v_norm, 5, 3600);
  if not coalesce(v_allowed,false) then return json_build_object('ok', false, 'error', 'Demasiados intentos. Probá más tarde.'); end if;
  v_code := lpad((floor(random()*1000000))::int::text, 6, '0');
  insert into prode_otp(phone, code_hash, expires_at)
  values (v_norm, encode(digest(v_norm||':'||v_code, 'sha256'),'hex'), now() + interval '10 minutes');
  return json_build_object('ok', true, 'code', v_code, 'phone', v_norm);
end;
$$;

-- Verificar OTP + crear/linkear cliente + participante + premio de bienvenida
create or replace function prode_verify_and_register(p_phone text, p_first_name text, p_last_name text, p_code text)
returns json language plpgsql security definer set search_path = public, extensions as $$
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

  -- auto-join Liga Monaco (house)
  insert into prode_league_members(league_id, participant_id)
  select l.id, v_participant_id from prode_leagues l where l.tournament_id=v_tournament and l.is_house
  on conflict (league_id, participant_id) do nothing;

  -- premio de bienvenida (si está configurado y aún no lo tiene)
  select welcome_reward_id into v_client_reward_id from prode_participants where id=v_participant_id;
  if v_client_reward_id is null then
    select id into v_reward_id from reward_catalog where organization_id=v_org and is_active and name='Cupón Mundial: Bienvenida' limit 1;
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
$$;

-- Completar perfil (email/DNI/nacimiento/consentimiento). Dedup por DNI.
create or replace function prode_complete_profile(p_participant_id uuid, p_email text, p_dni text, p_birthdate date, p_consent boolean)
returns json language plpgsql security definer set search_path = public as $$
declare v_dni text := nullif(regexp_replace(coalesce(p_dni,''),'\D','','g'),''); v_t uuid; v_dupe uuid;
begin
  select tournament_id into v_t from prode_participants where id=p_participant_id;
  if v_t is null then return json_build_object('ok', false, 'error', 'Participante no encontrado'); end if;
  if v_dni is not null then
    select id into v_dupe from prode_participants where dni=v_dni and tournament_id=v_t and id<>p_participant_id limit 1;
    if v_dupe is not null then return json_build_object('ok', false, 'error', 'Ese DNI ya está registrado'); end if;
  end if;
  update prode_participants set
    email=nullif(trim(coalesce(p_email,'')),''), dni=v_dni, birthdate=p_birthdate,
    consent_marketing=coalesce(p_consent,false),
    consent_at=case when p_consent then now() else consent_at end,
    profile_completed_at=now(), updated_at=now()
  where id=p_participant_id;
  return json_build_object('ok', true);
end;
$$;

-- Guardar la Quiniela (predicciones grandes). Bloquea si arrancó el torneo.
create or replace function prode_submit_quiniela(p_participant_id uuid, p_answers jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare v_t uuid; v_lock timestamptz; v_item jsonb; v_count int := 0;
begin
  select tournament_id into v_t from prode_participants where id=p_participant_id;
  if v_t is null then return json_build_object('ok', false, 'error', 'Participante no encontrado'); end if;
  select predictions_lock_at into v_lock from prode_tournament where id=v_t;
  if v_lock is not null and now() >= v_lock then return json_build_object('ok', false, 'error', 'La quiniela ya cerró'); end if;
  for v_item in select * from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) loop
    if (v_item->>'answer') is not null and (v_item->>'question_id') is not null then
      insert into prode_question_predictions(participant_id, question_id, answer)
      values (p_participant_id, (v_item->>'question_id')::uuid, v_item->>'answer')
      on conflict (participant_id, question_id) do update set answer=excluded.answer, updated_at=now()
        where prode_question_predictions.points_awarded is null;
      v_count := v_count + 1;
    end if;
  end loop;
  return json_build_object('ok', true, 'saved', v_count);
end;
$$;

-- Guardar predicción de partido (1X2 + marcador opcional). Bloquea en el kickoff.
create or replace function prode_submit_match_prediction(p_participant_id uuid, p_match_id uuid, p_outcome prode_match_outcome, p_home int, p_away int)
returns json language plpgsql security definer set search_path = public as $$
declare v_kick timestamptz; v_status prode_match_status;
begin
  select kickoff_at, status into v_kick, v_status from prode_matches where id=p_match_id;
  if v_kick is null then return json_build_object('ok', false, 'error', 'Partido no encontrado'); end if;
  if now() >= v_kick or v_status <> 'scheduled' then return json_build_object('ok', false, 'error', 'El partido ya empezó'); end if;
  insert into prode_match_predictions(participant_id, match_id, outcome, home_score, away_score)
  values (p_participant_id, p_match_id, p_outcome, p_home, p_away)
  on conflict (participant_id, match_id) do update
    set outcome=excluded.outcome, home_score=excluded.home_score, away_score=excluded.away_score, updated_at=now();
  return json_build_object('ok', true);
end;
$$;

-- Puntuar un partido finalizado (idempotente). Llamada por el edge function / admin.
create or replace function prode_score_match(p_match_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_m prode_matches%rowtype; v_s jsonb; v_out prode_match_outcome; v_op int; v_eb int; v_fm numeric; v_n int;
begin
  select * into v_m from prode_matches where id=p_match_id;
  if v_m.id is null then return json_build_object('ok', false, 'error', 'match not found'); end if;
  if v_m.status <> 'finished' or v_m.home_score is null or v_m.away_score is null then
    return json_build_object('ok', false, 'error', 'match not finished');
  end if;
  select settings into v_s from prode_tournament where id=v_m.tournament_id;
  v_op := coalesce((v_s->>'match_outcome_points')::int, 3);
  v_eb := coalesce((v_s->>'match_exact_bonus')::int, 2);
  v_fm := coalesce((v_s->>'featured_multiplier')::numeric, 2);
  v_out := (case when v_m.home_score>v_m.away_score then 'home' when v_m.home_score<v_m.away_score then 'away' else 'draw' end)::prode_match_outcome;
  update prode_match_predictions mp set
    is_correct = (mp.outcome = v_out),
    is_exact = (mp.home_score = v_m.home_score and mp.away_score = v_m.away_score),
    points_awarded = case when mp.outcome = v_out
      then round((v_op + case when mp.home_score=v_m.home_score and mp.away_score=v_m.away_score then v_eb else 0 end)
                 * (case when v_m.is_featured then v_fm else 1 end))::int
      else 0 end,
    updated_at = now()
  where mp.match_id = p_match_id;
  get diagnostics v_n = row_count;
  update prode_matches set result_processed_at=now(), updated_at=now() where id=p_match_id;
  return json_build_object('ok', true, 'scored', v_n, 'outcome', v_out);
end;
$$;

-- Resolver una pregunta de la Quiniela y puntuar.
create or replace function prode_resolve_question(p_question_id uuid, p_correct text)
returns json language plpgsql security definer set search_path = public as $$
declare v_pts int; v_n int;
begin
  select points into v_pts from prode_questions where id=p_question_id;
  if v_pts is null then return json_build_object('ok', false, 'error', 'question not found'); end if;
  update prode_questions set correct_answer=p_correct, resolved_at=now() where id=p_question_id;
  update prode_question_predictions set
    points_awarded = case when lower(trim(answer))=lower(trim(p_correct)) then v_pts else 0 end, updated_at=now()
  where question_id=p_question_id;
  get diagnostics v_n = row_count;
  return json_build_object('ok', true, 'scored', v_n);
end;
$$;

-- Ligas
create or replace function prode_create_league(p_participant_id uuid, p_name text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_t uuid; v_id uuid; v_code text;
begin
  select tournament_id into v_t from prode_participants where id=p_participant_id;
  if v_t is null then return json_build_object('ok', false, 'error', 'Participante no encontrado'); end if;
  insert into prode_leagues(tournament_id, name, owner_participant_id, is_public)
  values (v_t, coalesce(nullif(trim(p_name),''),'Mi Liga'), p_participant_id, false)
  returning id, invite_code into v_id, v_code;
  insert into prode_league_members(league_id, participant_id) values (v_id, p_participant_id) on conflict do nothing;
  return json_build_object('ok', true, 'league_id', v_id, 'invite_code', v_code);
end;
$$;

create or replace function prode_join_league(p_participant_id uuid, p_invite_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_t uuid; v_l prode_leagues%rowtype;
begin
  select tournament_id into v_t from prode_participants where id=p_participant_id;
  select * into v_l from prode_leagues where upper(invite_code)=upper(trim(p_invite_code)) limit 1;
  if v_l.id is null then return json_build_object('ok', false, 'error', 'Código de liga inválido'); end if;
  if v_l.tournament_id <> v_t then return json_build_object('ok', false, 'error', 'Liga de otro torneo'); end if;
  insert into prode_league_members(league_id, participant_id) values (v_l.id, p_participant_id) on conflict (league_id, participant_id) do nothing;
  return json_build_object('ok', true, 'league_id', v_l.id, 'name', v_l.name);
end;
$$;

create or replace function prode_league_info(p_invite_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', l.id, 'name', l.name, 'is_house', l.is_house,
    'members', (select count(*) from prode_league_members m where m.league_id=l.id))
  from prode_leagues l where upper(l.invite_code)=upper(trim(p_invite_code)) limit 1;
$$;

-- Tabla pública (solo columnas seguras; sin PII). league null => liga general.
create or replace function prode_public_leaderboard(p_tournament_id uuid, p_league_id uuid default null, p_limit int default 100)
returns table(rank bigint, participant_id uuid, display_name text, total_points int, exact_hits int)
language sql stable security definer set search_path = public as $$
  with base as (
    select p.id, p.display_name,
      (coalesce((select sum(coalesce(points_awarded,0)) from prode_question_predictions qp where qp.participant_id=p.id),0)
       + coalesce((select sum(coalesce(points_awarded,0)) from prode_match_predictions mp where mp.participant_id=p.id),0))::int as total_points,
      coalesce((select count(*) from prode_match_predictions mp where mp.participant_id=p.id and mp.is_exact),0)::int as exact_hits
    from prode_participants p
    where p.tournament_id = p_tournament_id
      and (p_league_id is null or exists (select 1 from prode_league_members lm where lm.league_id=p_league_id and lm.participant_id=p.id))
  )
  select row_number() over (order by total_points desc, exact_hits desc, id), id, display_name, total_points, exact_hits
  from base order by total_points desc, exact_hits desc, id limit greatest(p_limit,1);
$$;

-- Estado del participante (sus picks + puntos). Llamada server-side con id validado.
create or replace function prode_participant_summary(p_participant_id uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'participant_id', p.id,
    'display_name', p.display_name,
    'profile_completed', p.profile_completed_at is not null,
    'total_points', (coalesce((select sum(coalesce(points_awarded,0)) from prode_question_predictions qp where qp.participant_id=p.id),0)
                    + coalesce((select sum(coalesce(points_awarded,0)) from prode_match_predictions mp where mp.participant_id=p.id),0))::int,
    'quiniela', (select coalesce(json_agg(json_build_object('question_id', question_id, 'answer', answer, 'points', points_awarded)),'[]'::json)
                 from prode_question_predictions where participant_id=p.id),
    'matches', (select coalesce(json_agg(json_build_object('match_id', match_id, 'outcome', outcome, 'home', home_score, 'away', away_score, 'points', points_awarded)),'[]'::json)
                from prode_match_predictions where participant_id=p.id)
  ) from prode_participants p where p.id=p_participant_id;
$$;

-- Seguridad: revocar EXECUTE de public/anon/authenticated; solo service_role.
do $$ declare f text; begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname like 'prode\_%' escape '\'
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('revoke all on function %s from anon;', f);
    execute format('revoke all on function %s from authenticated;', f);
    execute format('grant execute on function %s to service_role;', f);
  end loop;
end $$;
