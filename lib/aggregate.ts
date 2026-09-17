import {
  BLOCK_ORDER,
  BLOCKS,
  BlockId,
  translateResultTitle,
  TIPO_TO_BLOCK,
} from "./config";
import type { CampaignRow } from "./reportei";

export interface BlockResult {
  id: BlockId;
  label: string;
  shortLabel: string;
  description: string;
  isBrandInvestment: boolean;
  costMode: "per_result" | "cpm";
  costLabel: string;
  spend: number;
  spendComparison: number;
  primaryMetricValue: number | null;
  primaryMetricValueComparison: number | null;
  primaryMetricLabel: string;
  costPerResult: number | null;
  campaignCount: number;
}

export type HealthLevel = "ok" | "watch" | "alert";

export interface HealthSignal {
  level: HealthLevel;
  /** Rotulo curto e direto pra exibir - "por que" fica so no title (hover), nao no texto principal. */
  label: string;
  reason: string;
  weeklyFrequency: number;
  cpmVsBlockMedianPct: number | null;
  costPerResultChangePct: number | null;
}

export const HEALTH_LABEL: Record<HealthLevel, string> = {
  ok: "Manter",
  watch: "Observar",
  alert: "Trocar/Desligar",
};

export interface CampaignDisplayRow {
  name: string;
  blockId: BlockId;
  spend: number;
  impressions: number;
  reach: number;
  resultValue: number | null;
  resultLabel: string | null;
  costPerResult: number | null;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  health: HealthSignal;
}

/** Le os tokens [TIPO] no nome da campanha e devolve o bloco correspondente, ou null se nao reconhecido. */
export function classifyCampaign(name: string): BlockId | null {
  const tokens = [...name.matchAll(/\[([^[\]]+)\]/g)].map((m) => m[1].trim().toUpperCase());
  for (const token of tokens) {
    if (token in TIPO_TO_BLOCK) return TIPO_TO_BLOCK[token];
  }
  return null;
}

/** Como classifyCampaign, mas campanha sem TIPO reconhecido cai no bloco "video" (o padrao atual da conta). */
function resolveBlock(name: string): BlockId {
  return classifyCampaign(name) ?? "video";
}

function aggregateBlock(blockId: BlockId, rows: CampaignRow[]) {
  let spend = 0;
  let resultSum = 0;
  let reach = 0;
  let impressions = 0;
  let resultTitle: string | null = null;

  for (const row of rows) {
    spend += row.spend;
    reach += row.reach;
    impressions += row.impressions;
    if (row.resultValue !== null) resultSum += row.resultValue;
    if (!resultTitle && row.resultTitle) resultTitle = row.resultTitle;
  }

  const isReconhecimento = blockId === "reconhecimento";
  const hasRows = rows.length > 0;

  const primaryMetricValue = hasRows ? (isReconhecimento ? reach : resultSum) : null;

  const fallbackLabel = blockId === "video" ? "Reproduções de vídeo" : "Interações com a publicação";
  const primaryMetricLabel = isReconhecimento
    ? "Pessoas alcançadas"
    : translateResultTitle(resultTitle) ?? fallbackLabel;

  const config = BLOCKS[blockId];
  const costPerResult =
    config.costMode === "cpm"
      ? impressions > 0
        ? (spend / impressions) * 1000
        : null
      : resultSum > 0
        ? spend / resultSum
        : null;

  return { spend, primaryMetricValue, primaryMetricLabel, costPerResult, campaignCount: rows.length };
}

export function buildBlocks(currentRows: CampaignRow[], comparisonRows: CampaignRow[]): BlockResult[] {
  const currentByBlock = groupByBlock(currentRows);
  const comparisonByBlock = groupByBlock(comparisonRows);

  return BLOCK_ORDER.map((blockId) => {
    const config = BLOCKS[blockId];
    const current = aggregateBlock(blockId, currentByBlock.get(blockId) ?? []);
    const comparison = aggregateBlock(blockId, comparisonByBlock.get(blockId) ?? []);

    return {
      id: blockId,
      label: config.label,
      shortLabel: config.shortLabel,
      description: config.description,
      isBrandInvestment: config.isBrandInvestment,
      costMode: config.costMode,
      costLabel: config.costLabel,
      spend: current.spend,
      spendComparison: comparison.spend,
      primaryMetricValue: current.primaryMetricValue,
      primaryMetricValueComparison: comparison.primaryMetricValue,
      primaryMetricLabel: current.primaryMetricLabel,
      costPerResult: current.costPerResult,
      campaignCount: current.campaignCount,
    };
  });
}

function groupByBlock(rows: CampaignRow[]): Map<BlockId, CampaignRow[]> {
  const map = new Map<BlockId, CampaignRow[]>();
  for (const row of rows) {
    const block = resolveBlock(row.name);
    if (!map.has(block)) map.set(block, []);
    map.get(block)!.push(row);
  }
  return map;
}

/** Custo por resultado de uma campanha, coerente com o que a tabela exibe (CPM p/ reconhecimento). */
function campaignCostPerResult(row: CampaignRow, blockId: BlockId): number | null {
  if (blockId === "reconhecimento") {
    return row.impressions > 0 ? (row.spend / row.impressions) * 1000 : null;
  }
  return row.costPerResultValue;
}

function countByName(rows: CampaignRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
  }
  return counts;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Limiares de saude do criativo, calibrados para o objetivo de video/reforco
// de marca politica (nao performance de clique): frequencia semanal de 2-6
// e a faixa recomendada durante a fase de persuasao (acima disso a mesma
// pessoa esta vendo o MESMO criativo demais vezes); CPM e comparado contra
// a mediana do proprio bloco no periodo, nao contra benchmark internacional,
// porque a praca (Canoas, Vale do Cai etc) muda o leilao demais pra isso
// fazer sentido; custo por resultado piorando e o sinal mais direto de
// fadiga, comparado ao periodo anterior de mesma duracao.
const WEEKLY_FREQUENCY_WATCH = 6;
const WEEKLY_FREQUENCY_ALERT = 8;
const CPM_VS_MEDIAN_WATCH = 0.3; // +30%
const CPM_VS_MEDIAN_ALERT = 0.6; // +60%
const COST_PER_RESULT_WATCH = 0.15; // +15%
const COST_PER_RESULT_ALERT = 0.25; // +25%

function buildHealthSignal(
  weeklyFrequency: number,
  cpmVsBlockMedianPct: number | null,
  costPerResultChangePct: number | null
): HealthSignal {
  const freqAlert = weeklyFrequency > WEEKLY_FREQUENCY_ALERT;
  const freqWatch = weeklyFrequency > WEEKLY_FREQUENCY_WATCH;
  const cpmAlert = cpmVsBlockMedianPct !== null && cpmVsBlockMedianPct > CPM_VS_MEDIAN_ALERT;
  const cpmWatch = cpmVsBlockMedianPct !== null && cpmVsBlockMedianPct > CPM_VS_MEDIAN_WATCH;
  const costAlert = costPerResultChangePct !== null && costPerResultChangePct > COST_PER_RESULT_ALERT;
  const costWatch = costPerResultChangePct !== null && costPerResultChangePct > COST_PER_RESULT_WATCH;

  const freqTxt = `${weeklyFrequency.toFixed(1)}/semana`;
  const cpmTxt = cpmVsBlockMedianPct !== null ? `CPM ${(cpmVsBlockMedianPct * 100).toFixed(0)}% acima da mediana do bloco` : null;
  const costTxt = costPerResultChangePct !== null ? `custo por resultado ${costPerResultChangePct >= 0 ? "subiu" : "caiu"} ${Math.abs(costPerResultChangePct * 100).toFixed(0)}%` : null;

  if (freqAlert || (freqWatch && costAlert) || (cpmAlert && costAlert)) {
    const parts = [`frequência ${freqTxt}`];
    if (costTxt) parts.push(costTxt);
    else if (cpmTxt) parts.push(cpmTxt);
    return {
      level: "alert",
      label: HEALTH_LABEL.alert,
      reason: `${parts.join(" e ")} — sinal de saturação nesse público.`,
      weeklyFrequency,
      cpmVsBlockMedianPct,
      costPerResultChangePct,
    };
  }

  if (freqWatch || cpmWatch || costWatch) {
    const parts: string[] = [];
    if (freqWatch) parts.push(`frequência subindo (${freqTxt})`);
    if (cpmTxt && cpmWatch) parts.push(cpmTxt);
    if (costTxt && costWatch) parts.push(costTxt);
    return {
      level: "watch",
      label: HEALTH_LABEL.watch,
      reason: parts.join(", "),
      weeklyFrequency,
      cpmVsBlockMedianPct,
      costPerResultChangePct,
    };
  }

  return {
    level: "ok",
    label: HEALTH_LABEL.ok,
    reason: "Frequência e custo dentro do esperado para reforço de marca.",
    weeklyFrequency,
    cpmVsBlockMedianPct,
    costPerResultChangePct,
  };
}

/** Uma linha por campanha, para a tabela detalhada - todas as campanhas. */
export function buildCampaignDisplayRows(
  rows: CampaignRow[],
  comparisonRows: CampaignRow[],
  periodDays: number
): CampaignDisplayRow[] {
  // O nome da campanha nao e garantidamente unico na conta (ja aconteceu
  // de duas campanhas distintas terem o nome idêntico) - se o nome se repete
  // em qualquer um dos periodos, o pareamento current<->comparison seria um
  // chute, entao tratamos como sem par (comparacao de custo fica ausente
  // pra essas em vez de arriscar comparar a campanha errada).
  const currentNameCounts = countByName(rows);
  const comparisonNameCounts = countByName(comparisonRows);
  const comparisonByName = new Map(comparisonRows.map((row) => [row.name, row]));
  const weeks = periodDays / 7;

  const cpmByBlock = new Map<BlockId, number[]>();
  for (const row of rows) {
    const blockId = resolveBlock(row.name);
    if (!cpmByBlock.has(blockId)) cpmByBlock.set(blockId, []);
    cpmByBlock.get(blockId)!.push(row.cpm);
  }
  const medianCpmByBlock = new Map<BlockId, number | null>(
    [...cpmByBlock.entries()].map(([blockId, cpms]) => [blockId, median(cpms)])
  );

  return rows
    .map((row) => {
      const blockId = resolveBlock(row.name);
      const isReconhecimento = blockId === "reconhecimento";
      const costPerResult = campaignCostPerResult(row, blockId);

      // So comparar custo por resultado se o periodo anterior teve gasto
      // minimo pra ser uma base estavel - campanha nova que rodou 1-2 dias
      // de rampa no periodo de comparacao tem custo artificialmente baixo
      // (fase de aprendizado), e isso infla a variacao sem ser fadiga real.
      const MIN_COMPARISON_SPEND = 50;
      const nameIsAmbiguous = currentNameCounts.get(row.name)! > 1 || comparisonNameCounts.get(row.name)! > 1;
      const comparisonRow = nameIsAmbiguous ? undefined : comparisonByName.get(row.name);
      const comparisonCostPerResult =
        comparisonRow && comparisonRow.spend >= MIN_COMPARISON_SPEND
          ? campaignCostPerResult(comparisonRow, blockId)
          : null;
      const costPerResultChangePct =
        costPerResult !== null && comparisonCostPerResult !== null && comparisonCostPerResult > 0
          ? (costPerResult - comparisonCostPerResult) / comparisonCostPerResult
          : null;

      const medianCpm = medianCpmByBlock.get(blockId) ?? null;
      const cpmVsBlockMedianPct = medianCpm !== null && medianCpm > 0 ? (row.cpm - medianCpm) / medianCpm : null;

      const weeklyFrequency = weeks > 0 ? row.frequency / weeks : row.frequency;

      return {
        name: row.name,
        blockId,
        spend: row.spend,
        impressions: row.impressions,
        reach: row.reach,
        resultValue: isReconhecimento ? row.reach : row.resultValue,
        resultLabel: isReconhecimento
          ? "Pessoas alcançadas"
          : (translateResultTitle(row.resultTitle) ?? row.resultTitle),
        costPerResult,
        ctr: row.ctr,
        cpc: row.cpc,
        cpm: row.cpm,
        frequency: row.frequency,
        health: buildHealthSignal(weeklyFrequency, cpmVsBlockMedianPct, costPerResultChangePct),
      };
    })
    .sort((a, b) => b.spend - a.spend);
}
