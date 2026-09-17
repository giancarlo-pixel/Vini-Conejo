import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions, AUTH_COOKIE_NAME, checkPassword, computeAuthToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let password: string | undefined;
  try {
    const body = await request.json();
    password = typeof body?.password === "string" ? body.password : undefined;
  } catch {
    return NextResponse.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  if (!process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: "DASHBOARD_PASSWORD não está configurado no servidor." },
      { status: 500 }
    );
  }

  if (!password || !(await checkPassword(password))) {
    return NextResponse.json({ ok: false, error: "Senha incorreta." }, { status: 401 });
  }

  const token = await computeAuthToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, token as string, authCookieOptions);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
