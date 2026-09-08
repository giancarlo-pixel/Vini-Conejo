import { REPORTEI_INTEGRATION_ID, REPORTEI_INTEGRATION_SLUG } from "./config";

const BASE_URL = "https://app.reportei.com/api/v2";

export type ReporteiErrorKind = "auth" | "network" | "unexpected_shape";

export class ReporteiError extends Error {
  kind: ReporteiErrorKind;
  constructor(kind: ReporteiErrorKind, message: string) {
    super(message);
    this.name = "ReporteiError";
    this.kind = kind;
  }
}

interface CatalogEntry {
  reference_key: string;
  [key: string]: unknown;
}

export interface CampaignRow {
  name: string;
  resultValue: number | null;
  resultTitle: string | null;
  costPerResultValue: number | null;
  costPerResultTitle: string | null;
  spend: number;
  reach: number;
  impressions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
}

let catalogCache: { data: CatalogEntry[]; fetchedAt: number } | null = null;
const CATALOG_TTL_MS = 3_600_000;

async function reporteiFetch(path: string, init?: RequestInit): Promise<unknown> {
  const token = process.env.REPORTEI_TOKEN;
  if (!token) {
    throw new ReporteiError("auth", "REPORTEI_TOKEN não está configurado no ambiente.");
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      next: { revalidate: 1800 },
    });
  } catch (err) {
    throw new ReporteiError(
      "network",
      `Falha de rede ao chamar a API do Reportei: ${(err as Error).message}`
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new ReporteiError("auth", "Token do Reportei inválido, expirado ou sem permissão.");
  }
  if (!response.ok) {
    throw new ReporteiError("network", `A API do Reportei respondeu com status ${response.status}.`);
  }

  try {
    return await response.json();
  } catch {
    throw new ReporteiError("unexpected_shape", "Resposta da API do Reportei não era um JSON válido.");
  }
}

function extractArray(json: unknown): unknown[] | null {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const data = (json as Record<string, unknown>).data;
    if (Array.isArray(data)) return data;
  }
  return null;
}

async function getCampaignsCatalogEntry(): Promise<CatalogEntry> {
  if (!catalogCache || Date.now() - catalogCache.fetchedAt >= CATALOG_TTL_MS) {
    const json = await reporteiFetch(`/metrics?integration_slug=${REPORTEI_INTEGRATION_SLUG}`);
    const data = extractArray(json);
    if (!data) {
      throw new ReporteiError(
        "unexpected_shape",
        "Catálogo de métricas do Reportei (GET /v2/metrics) veio em formato inesperado."
      );
    }
    catalogCache = { data: data as CatalogEntry[], fetchedAt: Date.now() };
  }

  const entry = catalogCache.data.find((m) => m.reference_key === "fb_ads:insights_by_campaign");
  if (!entry) {
    throw new ReporteiError(
      "unexpected_shape",
      "A métrica 'fb_ads:insights_by_campaign' não foi encontrada no catálogo do Reportei."
    );
  }
  return entry;
}

/**
 * Confirmado contra a API real: quando não há dados no período, a resposta é
 *   { "fb_ads:insights_by_campaign": { "warning": "There is no data for the
 *   selected period" } }
 * - um objeto com "warning", não um array vazio. Isso É o estado vazio
 * legítimo (zero linhas), não um erro. Quando há dados, as linhas vêm em
 *   { "fb_ads:insights_by_campaign": { "values": [ [...], [...] ] } }
 * - chave "values", não "rows". Cada linha é um array posicional
 *   [nome, results{value,title}, cost_per_results{value,title}, spend,
 *   reach, impressions, ctr, cpc, cpm, frequency] com os números vindo como
 *   string (ex: "323.75") - Number() já lida com isso.
 */
function looksLikeRow(candidate: unknown): candidate is unknown[] {
  return Array.isArray(candidate) && candidate.length >= 4 && typeof candidate[0] === "string";
}

function hasWarning(node: unknown): boolean {
  return !!node && typeof node === "object" && typeof (node as Record<string, unknown>).warning === "string";
}

function findRowsArray(node: unknown, depth: number): unknown[] | null {
  if (depth < 0) return null;
  if (Array.isArray(node)) {
    if (node.length === 0) return node;
    if (looksLikeRow(node[0])) return node;
    for (const item of node) {
      const found = findRowsArray(item, depth - 1);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === "object") {
    if (hasWarning(node)) return [];
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj.values)) return obj.values;
    if (Array.isArray(obj.rows)) return obj.rows;
    for (const key of Object.keys(obj)) {
      const found = findRowsArray(obj[key], depth - 1);
      if (found) return found;
    }
  }
  return null;
}

function asResultObj(value: unknown): { value: number; title: string } | null {
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.value !== undefined) {
      const n = Number(obj.value);
      return { value: Number.isFinite(n) ? n : 0, title: typeof obj.title === "string" ? obj.title : "" };
    }
  }
  return null;
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseRow(raw: unknown): CampaignRow | null {
  if (!Array.isArray(raw) || raw.length < 4 || typeof raw[0] !== "string") return null;
  const [name, resultsRaw, costPerResultsRaw, spend, reach, impressions, ctr, cpc, cpm, frequency] = raw;
  const results = asResultObj(resultsRaw);
  const costPerResults = asResultObj(costPerResultsRaw);
  return {
    name,
    resultValue: results?.value ?? null,
    resultTitle: results?.title || null,
    costPerResultValue: costPerResults?.value ?? null,
    costPerResultTitle: costPerResults?.title || null,
    spend: asNumber(spend),
    reach: asNumber(reach),
    impressions: asNumber(impressions),
    ctr: asNumber(ctr),
    cpc: asNumber(cpc),
    cpm: asNumber(cpm),
    frequency: asNumber(frequency),
  };
}

const insightsCache = new Map<string, { data: CampaignRow[]; fetchedAt: number }>();
const INSIGHTS_TTL_MS = 300_000; // 5 min - a conta compartilha 100 req/min com outros tokens da agência

/** Igual a getCampaignInsights, mas com cache em memória para não estourar o rate limit em recarregamentos. */
export async function getCampaignInsightsCached(start: string, end: string): Promise<CampaignRow[]> {
  const key = `${start}:${end}`;
  const cached = insightsCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < INSIGHTS_TTL_MS) {
    return cached.data;
  }
  const data = await getCampaignInsights(start, end);
  insightsCache.set(key, { data, fetchedAt: Date.now() });
  return data;
}

export async function getCampaignInsights(start: string, end: string): Promise<CampaignRow[]> {
  const catalogEntry = await getCampaignsCatalogEntry();

  const json = await reporteiFetch("/metrics/get-data", {
    method: "POST",
    body: JSON.stringify({
      integration_id: REPORTEI_INTEGRATION_ID,
      start,
      end,
      metrics: [{ ...catalogEntry, dimensions: ["campaign"] }],
    }),
  });

  const rows = findRowsArray(json, 4);
  if (rows === null) {
    throw new ReporteiError(
      "unexpected_shape",
      "Resposta de POST /metrics/get-data em formato não reconhecido."
    );
  }

  return rows.map(parseRow).filter((row): row is CampaignRow => row !== null);
}
