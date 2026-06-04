import { z } from "zod";

/**
 * Validated environment. Public (NEXT_PUBLIC_*) vars are inlined at build and
 * available in the browser; the rest are server-only (undefined in the browser,
 * hence optional). Mirrors the sharp-app pattern.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  // Server-only:
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  FOOTBALL_DATA_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  PRODE_ADMIN_PIN: z.string().optional(),
  PRODE_SESSION_SECRET: z.string().optional(),
  // Nombre de la plantilla WhatsApp (categoría "authentication") aprobada por Meta para el OTP.
  PRODE_WA_OTP_TEMPLATE: z.string().optional(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  FOOTBALL_DATA_API_KEY: process.env.FOOTBALL_DATA_API_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
  PRODE_ADMIN_PIN: process.env.PRODE_ADMIN_PIN,
  PRODE_SESSION_SECRET: process.env.PRODE_SESSION_SECRET,
  PRODE_WA_OTP_TEMPLATE: process.env.PRODE_WA_OTP_TEMPLATE,
});

export type Env = z.infer<typeof envSchema>;
