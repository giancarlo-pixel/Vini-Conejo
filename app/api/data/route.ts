import { NextRequest, NextResponse } from "next/server";
import { buildBlocks, buildCampaignDisplayRows } from "@/lib/aggregate";
import { PERIOD_LABELS, type PeriodPreset } from "@/lib/config";
import { daysBetween, getAccumulatedRange, getComparisonRange, getPeriodRange } from "@/lib/dates";
import { getCampaignInsightsCached, ReporteiError } from "@/lib/reportei";
import type { CampaignRow } from "@/lib/reportei";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sumTotals(rows: CampaignRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.spend += row.spend;
      acc.impressions += row.impressions;
      acc.reach += row.reach;
      return acc;
    },
    { spend: 0, impressions: 0, reach: 0 }
  );
}

function isValidPreset(value: string | null): value is PeriodPreset {
  return value !== null && value in PERIOD_LABELS;
}

function errorPayload(err: unknown) {
  if (err instanceof ReporteiError) {
    return { kind: err.kind, message: err.message };
  }
  return { kind: "unknown" as const, message: "Erro inesperado ao buscar dados do Reportei." };
}

export async function GET(request: NextRequest) {
  const presetParam = request.nextUrl.searchParams.get("period");
  const preset: PeriodPreset = isValidPreset(presetParam) ? presetParam : "7";

  const range = getPeriodRange(preset);
  const comparisonRange = getComparisonRange(range);
  const accumulatedRange = getAccumulatedRange();

  try {
    // Sequencial, nao Promise.all: chamadas simultaneas pro Reportei
    // disparavam um limite de rajada da API (100 req/min e compartilhado
    // com outros tokens da agencia) e voltavam com corpo em formato
    // inesperado. Uma chamada por vez e mais lento mas confiavel. Um
    // pequeno intervalo entre elas da margem extra contra o limite
    // compartilhado (getCampaignInsightsCached ja tem retry com backoff
    // para quando isso nao for suficiente).
    const currentRows = await getCampaignInsightsCached(range.start, range.end);
    await sleep(400);
    const comparisonRows = await getCampaignInsightsCached(comparisonRange.start, comparisonRange.end);

    const blocks = buildBlocks(currentRows, comparisonRows);
    const periodDays = daysBetween(range.start, range.end);
    const campaigns = buildCampaignDisplayRows(currentRows, comparisonRows, periodDays);
    const totals = sumTotals(currentRows);
    const totalsComparison = sumTotals(comparisonRows);

    // O acumulado (desde a abertura da janela eleitoral, 16/08) e uma
    // consulta separada e cada vez mais larga - nao deixar uma instabilidade
    // nela derrubar o resto do painel, que ja carregou com sucesso. Se
    // falhar, o front mostra "indisponivel" so nessa barra.
    let accumulatedSpend: number | null = null;
    let accumulatedError: ReturnType<typeof errorPayload> | null = null;
    try {
      await sleep(400);
      const accumulatedRows = await getCampaignInsightsCached(accumulatedRange.start, accumulatedRange.end);
      accumulatedSpend = accumulatedRows.reduce((sum, row) => sum + row.spend, 0);
    } catch (err) {
      accumulatedError = errorPayload(err);
    }

    return NextResponse.json({
      period: preset,
      range,
      comparisonRange,
      isPartial: range.isPartial,
      hasAnyData: currentRows.length > 0,
      accumulatedSpend,
      accumulatedRange,
      accumulatedError,
      totals,
      totalsComparison,
      blocks,
      campaigns,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof ReporteiError) {
      const status = err.kind === "auth" ? 500 : err.kind === "rate_limit" ? 503 : 502;
      return NextResponse.json({ error: errorPayload(err) }, { status });
    }
    return NextResponse.json({ error: errorPayload(err) }, { status: 500 });
  }
}
