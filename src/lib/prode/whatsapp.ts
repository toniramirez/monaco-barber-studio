import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { MONACO_ORG } from "./types";

/**
 * Envía el código OTP por WhatsApp usando la Meta Cloud API ya configurada para
 * Monaco (organization_whatsapp_config). Requiere una plantilla "authentication"
 * aprobada por Meta (env PRODE_WA_OTP_TEMPLATE).
 *
 * Fallback dev: si no hay config/plantilla, loguea el código y devuelve sent:false
 * con el código, para poder testear el flujo de punta a punta sin WhatsApp.
 */
export async function sendOtpWhatsApp(
  phoneDigits: string,
  code: string,
): Promise<{ sent: boolean; channel: string; devCode?: string }> {
  const template = env.PRODE_WA_OTP_TEMPLATE;
  const isProd = process.env.NODE_ENV === "production";

  type WaCfg = { whatsapp_access_token: string | null; whatsapp_phone_id: string | null; is_active: boolean | null };
  let cfg: WaCfg | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("organization_whatsapp_config")
      .select("whatsapp_access_token, whatsapp_phone_id, is_active")
      .eq("organization_id", MONACO_ORG)
      .maybeSingle();
    cfg = (data as unknown as WaCfg | null) ?? null;
  } catch {
    cfg = null;
  }

  if (!template || !cfg?.is_active || !cfg.whatsapp_access_token || !cfg.whatsapp_phone_id) {
    console.warn(`[prode][otp] WhatsApp no configurado o plantilla ausente. Código DEV para ${phoneDigits}: ${code}`);
    return { sent: false, channel: "dev", devCode: isProd ? undefined : code };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${cfg.whatsapp_phone_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.whatsapp_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneDigits.replace(/\D/g, ""),
          type: "template",
          template: {
            name: template,
            language: { code: "es_AR" },
            // Plantilla de autenticación de Meta: body con el código + botón copy-code.
            components: [
              { type: "body", parameters: [{ type: "text", text: code }] },
              { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
            ],
          },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      console.error("[prode][otp] Meta API error", res.status, detail);
      return { sent: false, channel: "meta_error", devCode: isProd ? undefined : code };
    }
    return { sent: true, channel: "meta" };
  } catch (e) {
    console.error("[prode][otp] fetch error", e);
    return { sent: false, channel: "exception", devCode: isProd ? undefined : code };
  }
}
