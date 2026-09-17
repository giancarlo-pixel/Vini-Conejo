export const AUTH_COOKIE_NAME = "vc_dash_auth";
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Token guardado no cookie: hash da senha, nunca a senha em texto puro.
 * Recalculado a partir de DASHBOARD_PASSWORD para validar o cookie -
 * não há estado de sessão além disso (senha única, compartilhada pela equipe).
 */
export async function computeAuthToken(): Promise<string | null> {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return null;
  return sha256Hex(`vini-conejo-dashboard:${password}`);
}

export async function checkPassword(candidate: string): Promise<boolean> {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return false;
  return candidate === password;
}

export async function isAuthCookieValid(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const expected = await computeAuthToken();
  return expected !== null && cookieValue === expected;
}

export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
};
