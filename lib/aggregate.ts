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

/** Uma linha por campanha, para a tabela detalhada - todas as campanhas. */
export function buildCampaignDisplayRows(rows: CampaignRow[]): CampaignDisplayRow[] {
  return rows
    .map((row) => {
      const blockId = resolveBlock(row.name);
      const isReconhecimento = blockId === "reconhecimento";
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
        costPerResult: isReconhecimento
          ? row.impressions > 0
            ? (row.spend / row.impressions) * 1000
            : null
          : row.costPerResultValue,
        ctr: row.ctr,
        cpc: row.cpc,
        cpm: row.cpm,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}
