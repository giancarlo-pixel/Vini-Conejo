import { NextResponse } from "next/server";
import { CAMPAIGN_WINDOW_START_DATE, REPORTEI_INTEGRATION_ID, REPORTEI_INTEGRATION_SLUG } from "@/lib/config";
import { todaySaoPaulo } from "@/lib/dates";

const BASE_URL = "https://app.reportei.com/api/v2";

/**
 * Endpoint temporario de diagnostico - NAO faz parte do produto final.
 * Mostra a resposta bruta da API do Reportei para conferir o formato real
 * contra o que lib/reportei.ts espera. Remover depois de confirmado.
 */
export async function GET() {
  const token = process.env.REPORTEI_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "REPORTEI_TOKEN não configurado." }, { status: 500 });
  }

  const catalogRes = await fetch(`${BASE_URL}/metrics?integration_slug=${REPORTEI_INTEGRATION_SLUG}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const catalogJson = await catalogRes.json().catch(() => null);
  const catalogList = Array.isArray(catalogJson) ? catalogJson : catalogJson?.data;
  const entry = Array.isArray(catalogList)
    ? catalogList.find((m: { reference_key?: string }) => m?.reference_key === "fb_ads:insights_by_campaign")
    : null;

  const start = CAMPAIGN_WINDOW_START_DATE;
  const end = todaySaoPaulo();

  const dataRes = await fetch(`${BASE_URL}/metrics/get-data`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      integration_id: REPORTEI_INTEGRATION_ID,
      start,
      end,
      metrics: entry ? [{ ...entry, dimensions: ["campaign"] }] : [],
    }),
  });
  const dataJson = await dataRes.json().catch(() => null);

  return NextResponse.json({
    integrationIdUsed: REPORTEI_INTEGRATION_ID,
    range: { start, end },
    catalog: {
      httpStatus: catalogRes.status,
      entryFound: !!entry,
      entry,
    },
    getData: {
      httpStatus: dataRes.status,
      raw: dataJson,
    },
  });
}
