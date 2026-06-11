-- 20260611200000_prode_welcome_coupon_15day_validity.sql
-- El cupón de bienvenida se emitía con vigencia de 48h (prode_auth_with_pin), lo que con
-- la nueva regla "canjeable solo lunes a miércoles" (mig 151) dejaba inusables los
-- cupones emitidos un jueves/viernes (vencían antes de llegar a un Lun-Mié).
--
-- Cambios:
--   A) prode_auth_with_pin emite el cupón con expires_at = created_at + reward_catalog.validity_days
--      (15 días para bienvenida; fallback 2 días si no hay config). Single source of truth
--      en reward_catalog junto con activation_delay_minutes y redeemable_weekdays.
--   B) Backfill de los cupones de bienvenida ya emitidos y NO canjeados: vigencia de 15 días
--      desde su emisión, sin ACORTAR los que ya tienen más (GREATEST), reviviendo los que
--      expiraron por la ventana de 48h pero siguen dentro de los 15 días desde created_at.
--
-- Nota: el path OTP (prode_verify_and_register) NO está activo (la app usa PIN); no se toca.

-- Defensivo: la columna la agrega la mig 151 (dashboard); IF NOT EXISTS la hace self-contained.
ALTER TABLE public.reward_catalog
  ADD COLUMN IF NOT EXISTS validity_days int;

-- ---------------------------------------------------------------------------
-- A. Emisión con vigencia configurable (validity_days)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prode_auth_with_pin(
  p_phone text,
  p_pin text,
  p_first_name text DEFAULT NULL::text,
  p_last_name text DEFAULT NULL::text,
  p_birthdate date DEFAULT NULL::date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
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
  v_validity_days int;
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

  insert into prode_participants(client_id, tournament_id, display_name, last_name, birthdate, phone_verified_at, pin_hash)
  values (v_client_id, v_tournament, v_display, nullif(trim(coalesce(p_last_name,'')),''), p_birthdate, now(), crypt(p_pin, gen_salt('bf')))
  returning id into v_participant_id;

  insert into prode_league_members(league_id, participant_id)
  select l.id, v_participant_id from prode_leagues l where l.tournament_id=v_tournament and l.is_house
  on conflict (league_id, participant_id) do nothing;

  select id, validity_days into v_reward_id, v_validity_days from reward_catalog
    where organization_id=v_org and is_active
      and id=(select (settings->>'welcome_reward_id')::uuid from prode_tournament where id=v_tournament) limit 1;
  if v_reward_id is null then
    select id, validity_days into v_reward_id, v_validity_days from reward_catalog
      where organization_id=v_org and is_active and name='Cupón Mundial: Bienvenida' limit 1;
  end if;
  if v_reward_id is not null then
    insert into client_rewards(client_id, reward_id, status, source, organization_id, expires_at)
    values (v_client_id, v_reward_id, 'available', 'manual', v_org, now() + make_interval(days => coalesce(v_validity_days, 2)))
    returning id into v_client_reward_id;
    update prode_participants set welcome_reward_id=v_client_reward_id where id=v_participant_id;
  end if;

  return json_build_object('ok', true, 'participant_id', v_participant_id,
    'display_name', v_display, 'is_new', true, 'welcome_reward_id', v_client_reward_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- B. Backfill: 15 días de vigencia para los cupones de bienvenida ya emitidos.
--    GREATEST = nunca acorta; revive los expirados que siguen dentro de los 15 días.
-- ---------------------------------------------------------------------------
UPDATE public.client_rewards
SET expires_at = GREATEST(expires_at, created_at + interval '15 days'),
    status = CASE
      WHEN status = 'expired' AND GREATEST(expires_at, created_at + interval '15 days') > now()
      THEN 'available'::client_reward_status
      ELSE status END
WHERE reward_id = 'bb46f40a-0969-4767-8a72-3b57318196af'
  AND status <> 'redeemed';
