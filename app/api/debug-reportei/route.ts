import { NextRequest, NextResponse } from "next/server";
import { REPORTEI_INTEGRATION_ID, REPORTEI_INTEGRATION_SLUG } from "@/lib/config";
import { todaySaoPaulo } from "@/lib/dates";

const BASE_URL = "https://app.reportei.com/api/v2";

export async function GET(request: NextRequest) {
  const token = process.env.REPORTEI_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "REPORTEI_TOKEN não configurado." }, { status: 500 });
  }

  const start = request.nextUrl.searchParams.get("start") ?? "2026-08-16";
  const end = request.nextUrl.searchParams.get("end") ?? todaySaoPaulo();

  const catalogRes = await fetch(`${BASE_URL}/metrics?integration_slug=${REPORTEI_INTEGRATION_SLUG}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const catalogJson = await catalogRes.json().catch(() => null);
  const catalogList = Array.isArray(catalogJson) ? catalogJson : catalogJson?.data;
  const entry = Array.isArray(catalogList)
    ? catalogList.find((m: { reference_key?: string }) => m?.reference_key === "fb_ads:insights_by_campaign")
    : null;

  const dataRes = await fetch(`${BASE_URL}/metrics/get-data`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      integration_id: REPORTEI_INTEGRATION_ID,
      start,
      end,
      metrics: entry ? [entry] : [],
    }),
  });
  const rawText = await dataRes.text();

  return NextResponse.json({
    range: { start, end },
    catalog: { httpStatus: catalogRes.status, entryFound: !!entry },
    getData: {
      httpStatus: dataRes.status,
      contentLength: rawText.length,
      raw: rawText.length > 8000 ? rawText.slice(0, 8000) + "...[cortado]" : rawText,
    },
  });
}
