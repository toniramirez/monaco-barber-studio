import shell from "../Shell.module.css";
import PremiosClient from "./PremiosClient";
import { getMyRewards, getWelcomeCouponRules } from "@/lib/prode/data";
import { getProdeParticipantId } from "@/lib/prode/session";
import { couponViewFromReward, type CouponView } from "@/lib/prode/coupon";

export const dynamic = "force-dynamic";

const WELCOME_DISCOUNT = 20; // fallback (invitado sin cupón); el real sale del reward_catalog
const WELCOME_WEEKDAYS_FALLBACK = [1, 2, 3]; // lun–mié, por si el catálogo no resuelve
const WELCOME_VALIDITY_FALLBACK = 15; // días

/**
 * Premios — la vidriera del Prode. Bienvenida 20%, la camiseta como objeto-héroe
 * (flip 3D), premios por desafío y el podio del Gran Premio.
 *
 * El cupón de bienvenida tiene reglas reales (cooldown de 2 h + ventana lun–mié +
 * 15 días) que vienen del backend (reward_catalog → prode_my_rewards). Las pasamos
 * tal cual al cliente, que las dibuja en vivo según su reloj. NO computamos la fase
 * acá: depende de "ahora" y se calcula client-side para no romper la hidratación.
 *
 * También leemos las reglas del catálogo (getWelcomeCouponRules) para poder comunicar
 * la ventana lun–mié / 15 días incluso a un visitante NO registrado (que aún no tiene
 * fila de cupón) — clave para que no se cree la cuenta en la silla esperando usarlo ya.
 */
export default async function PremiosPage() {
  const pid = await getProdeParticipantId();

  const [rewards, rules] = await Promise.all([
    pid ? getMyRewards(pid) : Promise.resolve([]),
    getWelcomeCouponRules(),
  ]);

  const welcomeReward = rewards.find((r) => /bienvenida/i.test(r.name)) ?? null;
  const welcome: CouponView | null = welcomeReward ? couponViewFromReward(welcomeReward) : null;
  const welcomeDiscountPct = welcomeReward?.discount_pct ?? rules?.discount_pct ?? WELCOME_DISCOUNT;
  const ruleWeekdays = rules?.redeemable_weekdays ?? WELCOME_WEEKDAYS_FALLBACK;
  const validityDays = rules?.validity_days ?? WELCOME_VALIDITY_FALLBACK;

  return (
    <main className={shell.content}>
      <PremiosClient
        registered={!!pid}
        welcomeDiscountPct={welcomeDiscountPct}
        welcome={welcome}
        ruleWeekdays={ruleWeekdays}
        validityDays={validityDays}
      />
    </main>
  );
}
