-- Prode — login de jugadores por PIN (sin OTP). ADITIVO, prod-safe.
-- El PIN se guarda HASHEADO (bcrypt vía pgcrypto crypt/gen_salt). Nunca en claro.
-- pin_hash NULL = "se fija en el próximo login" (cubre participantes viejos sin
-- PIN y el caso post-reset desde el panel).

alter table prode_participants add column if not exists pin_hash text;

-- RPC unificada: registra (si manda nombre), loguea (verifica PIN), o reclama
-- (si pin_hash es NULL). Devuelve need_name=true cuando el teléfono no existe y
-- no vino nombre, para que la UI revele el campo nombre. Espeja la creación de
-- prode_verify_and_register (cliente + participante + liga de la casa + cupón)
-- sin el bloque OTP.
create or replace function public.prode_auth_with_pin(
  p_phone text,
  p_pin text,
  p_first_name text default null,
  p_last_name text default null
)
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

  -- ===== Participante existente: login o claim =====
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

  -- ===== No existe: hace falta nombre para crear =====
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

  -- Cupón de bienvenida (mapeo settings con fallback al nombre, igual que verify_and_register)
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

  return json_build_object('ok', true, 'participant_id', v_participant_id,
    'display_name', v_display, 'is_new', true, 'welcome_reward_id', v_client_reward_id);
end;
$function$;

-- Mismas garantías que el resto de prode_*: solo service_role ejecuta.
revoke all on function public.prode_auth_with_pin(text, text, text, text) from public;
grant execute on function public.prode_auth_with_pin(text, text, text, text) to service_role;
