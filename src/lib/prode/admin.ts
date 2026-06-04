import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Gate del panel /admin/prode por PIN (env PRODE_ADMIN_PIN). Cookie httpOnly firmada. */
const COOKIE = "prode_admin";

function secret(): string {
  const s = env.PRODE_SESSION_SECRET;
  if (!s) {
    // Mismo secreto que gatea el panel /admin/prode: no firmar con una constante
    // pública en producción (permitiría forjar la cookie de admin).
    if (process.env.NODE_ENV === "production") {
      throw new Error("PRODE_SESSION_SECRET no está configurado en producción");
    }
    return "dev-insecure-prode-secret-change-me";
  }
  return s;
}
function adminToken(): string {
  return createHmac("sha256", secret()).update("prode-admin-v1").digest("base64url");
}

export async function isProdeAdmin(): Promise<boolean> {
  const c = await cookies();
  const v = c.get(COOKIE)?.value;
  if (!v) return false;
  const expected = adminToken();
  try {
    const a = Buffer.from(v);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  const expected = env.PRODE_ADMIN_PIN;
  if (!expected) return false; // sin PIN configurado, no se permite entrar
  const a = Buffer.from(String(pin ?? ""));
  const b = Buffer.from(expected);
  const equal = a.length === b.length && timingSafeEqual(a, b);
  if (!equal) return false;
  const c = await cookies();
  c.set(COOKIE, adminToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
  });
  return true;
}

export async function clearAdmin(): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, "", { path: "/admin", maxAge: 0 });
}
