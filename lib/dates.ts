import { CAMPAIGN_WINDOW_START_DATE, type PeriodPreset } from "./config";

const TIMEZONE = "America/Sao_Paulo";

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

/** Data de hoje (YYYY-MM-DD) no fuso do cliente, nao no fuso do servidor. */
export function todaySaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}

function toUTCDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  const date = toUTCDate(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateStr(date);
}

export function daysBetween(start: string, end: string): number {
  const diff = toUTCDate(end).getTime() - toUTCDate(start).getTime();
  return Math.round(diff / 86_400_000) + 1;
}

/**
 * Intervalo do preset selecionado. Presets de dias terminam sempre ONTEM -
 * dado de hoje e parcial e distorce a comparacao. "Hoje" e a unica excecao,
 * e vem com isPartial=true para a UI avisar explicitamente.
 */
export function getPeriodRange(preset: PeriodPreset): DateRange & { isPartial: boolean } {
  const today = todaySaoPaulo();
  if (preset === "today") {
    return { start: today, end: today, isPartial: true };
  }
  const yesterday = addDays(today, -1);
  const days = Number(preset);
  return { start: addDays(yesterday, -(days - 1)), end: yesterday, isPartial: false };
}

/** Periodo anterior de mesma duracao, terminando no dia anterior ao inicio do periodo atual. */
export function getComparisonRange(range: DateRange): DateRange {
  const length = daysBetween(range.start, range.end);
  const end = addDays(range.start, -1);
  const start = addDays(end, -(length - 1));
  return { start, end };
}

/** Desde a abertura da janela eleitoral ate hoje - gasto acumulado, nao performance. */
export function getAccumulatedRange(): DateRange {
  return { start: CAMPAIGN_WINDOW_START_DATE, end: todaySaoPaulo() };
}

export function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Valida "YYYY-MM-DD" e devolve um DateRange (start<=end, end<=hoje), ou null se invalido. */
export function parseCustomRange(startParam: string | null, endParam: string | null): (DateRange & { isPartial: boolean }) | null {
  if (!startParam || !endParam) return null;
  if (!DATE_RE.test(startParam) || !DATE_RE.test(endParam)) return null;
  const today = todaySaoPaulo();
  if (startParam > endParam) return null;
  const end = endParam > today ? today : endParam;
  return { start: startParam, end, isPartial: end === today };
}
