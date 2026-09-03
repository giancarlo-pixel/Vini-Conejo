const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(Math.round(value));
}

export function formatDelta(current: number, previous: number): { pct: number | null; direction: "up" | "down" | "flat" } {
  if (previous <= 0) {
    if (current <= 0) return { pct: null, direction: "flat" };
    return { pct: null, direction: "up" };
  }
  const pct = ((current - previous) / previous) * 100;
  const direction = pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat";
  return { pct, direction };
}
