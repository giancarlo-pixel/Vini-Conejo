import { NextRequest, NextResponse } from "next/server";
import { buildBlocks, buildCampaignDisplayRows } from "@/lib/aggregate";
import { PERIOD_LABELS, type PeriodPreset } from "@/lib/config";
import { getAccumulatedRange, getComparisonRange, getPeriodRange, parseCustomRange } from "@/lib/dates";
import { getCampaignInsightsCached, ReporteiError } from "@/lib/reportei";
import type { CampaignRow } from "@/lib/reportei";

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

export async function GET(request: NextRequest) {
  const presetParam = request.nextUrl.searchParams.get("period");
  const preset: PeriodPreset = isValidPreset(presetParam) ? presetParam : "7";

  const customRange = parseCustomRange(
    request.nextUrl.searchParams.get("start"),
    request.nextUrl.searchParams.get("end")
  );
  const range = customRange ?? getPeriodRange(preset);
  const comparisonRange = getComparisonRange(range);
  const accumulatedRange = getAccumulatedRange();

  try {
    // Sequencial, nao Promise.all: 3 chamadas simultaneas pro Reportei
    // disparavam um limite de rajada da API (100 req/min e compartilhado
    // com outros tokens da agencia) e voltavam com corpo em formato
    // inesperado. Uma chamada por vez e mais lento mas confiavel.
    const currentRows = await getCampaignInsightsCached(range.start, range.end);
    const comparisonRows = await getCampaignInsightsCached(comparisonRange.start, comparisonRange.end);
    const accumulatedRows = await getCampaignInsightsCached(accumulatedRange.start, accumulatedRange.end);

    const blocks = buildBlocks(currentRows, comparisonRows);
    const campaigns = buildCampaignDisplayRows(currentRows);
    const accumulatedSpend = accumulatedRows.reduce((sum, row) => sum + row.spend, 0);
    const totals = sumTotals(currentRows);
    const totalsComparison = sumTotals(comparisonRows);

    return NextResponse.json({
      period: customRange ? "custom" : preset,
      range,
      comparisonRange,
      isPartial: range.isPartial,
      hasAnyData: currentRows.length > 0,
      accumulatedSpend,
      accumulatedRange,
      totals,
      totalsComparison,
      blocks,
      campaigns,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof ReporteiError) {
      const status = err.kind === "auth" ? 500 : 502;
      return NextResponse.json({ error: { kind: err.kind, message: err.message } }, { status });
    }
    return NextResponse.json(
      { error: { kind: "unknown", message: "Erro inesperado ao buscar dados do Reportei." } },
      { status: 500 }
    );
  }
}
