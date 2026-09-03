"use client";

import { useCallback, useEffect, useState } from "react";
import { PERIOD_LABELS, type PeriodPreset, BLOCK_COLORS } from "@/lib/config";
import { formatCurrency, formatDelta, formatNumber } from "@/lib/format";
import { formatDateBR } from "@/lib/dates";
import type { BlockResult, UnclassifiedResult } from "@/lib/aggregate";

interface DataResponse {
  period: PeriodPreset;
  range: { start: string; end: string };
  comparisonRange: { start: string; end: string };
  isPartial: boolean;
  hasAnyData: boolean;
  accumulatedSpend: number;
  accumulatedRange: { start: string; end: string };
  blocks: BlockResult[];
  unclassified: UnclassifiedResult;
  generatedAt: string;
}

interface ErrorResponse {
  error: { kind: "auth" | "network" | "unexpected_shape" | "unknown"; message: string };
}

const PRESETS: PeriodPreset[] = ["today", "7", "14", "30"];

export default function Dashboard() {
  const [period, setPeriod] = useState<PeriodPreset>("7");
  const [data, setData] = useState<DataResponse | null>(null);
  const [error, setError] = useState<ErrorResponse["error"] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: PeriodPreset) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/data?period=${p}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) {
        setError((json as ErrorResponse).error);
        setData(null);
      } else {
        setData(json as DataResponse);
      }
    } catch {
      setError({ kind: "network", message: "Não foi possível conectar ao servidor." });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [load, period]);

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Dashboard de Performance</h1>
          <p className="header-subtitle">Dr. Vinícius Conejo — Meta Ads · Campanha 2026</p>
        </div>
        <div className="header-actions no-print">
          <button className="btn-ghost" onClick={() => window.print()}>
            Exportar PDF
          </button>
          <button className="btn-ghost" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      <AccumulatedBar spend={data?.accumulatedSpend} range={data?.accumulatedRange} loading={loading} />

      <div className="period-selector no-print">
        {PRESETS.map((p) => (
          <button
            key={p}
            className={p === period ? "period-btn active" : "period-btn"}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {data?.isPartial && (
        <p className="partial-warning">
          Dado parcial de hoje — a veiculação ainda está em andamento e os números vão mudar ao longo do dia.
        </p>
      )}

      {loading && <LoadingState />}

      {!loading && error && <ErrorState error={error} onRetry={() => load(period)} />}

      {!loading && !error && data && !data.hasAnyData && (
        <EmptyState range={data.range} periodLabel={PERIOD_LABELS[period]} />
      )}

      {!loading && !error && data && data.hasAnyData && (
        <>
          <div className="blocks-grid">
            {data.blocks.map((block) => (
              <BlockCard key={block.id} block={block} />
            ))}
          </div>
          {data.unclassified.campaignCount > 0 && <UnclassifiedCard unclassified={data.unclassified} />}
        </>
      )}

      {data && (
        <footer className="footer no-print">
          Período: {formatDateBR(data.range.start)} a {formatDateBR(data.range.end)} · Atualizado em{" "}
          {new Date(data.generatedAt).toLocaleString("pt-BR")}
        </footer>
      )}
    </div>
  );
}

function AccumulatedBar({
  spend,
  range,
  loading,
}: {
  spend?: number;
  range?: { start: string; end: string };
  loading: boolean;
}) {
  return (
    <section className="accumulated-bar">
      <div>
        <span className="accumulated-label">Gasto acumulado da campanha</span>
        <span className="accumulated-hint">
          {range ? `Desde ${formatDateBR(range.start)} — controle para prestação de contas` : "Carregando…"}
        </span>
      </div>
      <span className="accumulated-value">
        {loading || spend === undefined ? "—" : formatCurrency(spend)}
      </span>
    </section>
  );
}

function LoadingState() {
  return <div className="state-panel state-loading">Carregando dados do Reportei…</div>;
}

function ErrorState({
  error,
  onRetry,
}: {
  error: ErrorResponse["error"];
  onRetry: () => void;
}) {
  const hint =
    error.kind === "auth"
      ? "Verifique se a variável REPORTEI_TOKEN está configurada corretamente na Vercel."
      : "Isso costuma ser temporário. Tente novamente em alguns instantes.";
  return (
    <div className="state-panel state-error">
      <strong>Não foi possível carregar os dados.</strong>
      <p>{error.message}</p>
      <p className="state-hint">{hint}</p>
      <button className="btn-ghost" onClick={onRetry}>
        Tentar novamente
      </button>
    </div>
  );
}

function EmptyState({ range, periodLabel }: { range: { start: string; end: string }; periodLabel: string }) {
  return (
    <div className="state-panel state-empty">
      <strong>Nenhuma veiculação registrada neste período.</strong>
      <p>
        As campanhas desta conta ainda não começaram a rodar entre {formatDateBR(range.start)} e{" "}
        {formatDateBR(range.end)} ({periodLabel}). Isso é esperado antes do início da veiculação eleitoral —
        assim que as campanhas subirem, os números aparecem aqui automaticamente.
      </p>
    </div>
  );
}

function BlockCard({ block }: { block: BlockResult }) {
  const color = BLOCK_COLORS[block.id];
  const delta = formatDelta(block.spend, block.spendComparison);
  const hasResult = block.campaignCount > 0;

  return (
    <article className="block-card" style={{ "--block-color": color.light, "--block-color-dark": color.dark } as React.CSSProperties}>
      <div className="block-card-header">
        <span className="block-dot" />
        <h2>{block.label}</h2>
      </div>
      {block.isBrandInvestment && <span className="block-tag">Investimento em presença de marca</span>}

      {hasResult ? (
        <>
          <div className="block-metric">
            <span className="block-metric-value">{formatNumber(block.primaryMetricValue ?? 0)}</span>
            <span className="block-metric-label">{block.primaryMetricLabel}</span>
          </div>
          <dl className="block-details">
            <div>
              <dt>Investimento</dt>
              <dd>
                {formatCurrency(block.spend)}
                {delta.pct !== null && (
                  <span className={`delta delta-${delta.direction}`}>
                    {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "—"}{" "}
                    {Math.abs(delta.pct).toFixed(0)}%
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>{block.costLabel}</dt>
              <dd>{block.costPerResult !== null ? formatCurrency(block.costPerResult) : "—"}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="block-empty">Sem veiculação neste bloco no período selecionado.</p>
      )}
    </article>
  );
}

function UnclassifiedCard({ unclassified }: { unclassified: UnclassifiedResult }) {
  return (
    <article className="unclassified-card">
      <h2>⚠ Campanhas não classificadas</h2>
      <p>
        {unclassified.campaignCount} campanha(s) fora do padrão de nomenclatura, somando{" "}
        {formatCurrency(unclassified.spend)}. Renomeie seguindo o padrão{" "}
        <code>NN [DD/MM/AA] [TIPO] [PLATAFORMA] [CRIATIVO]</code> para que entrem nos blocos corretos.
      </p>
      <ul>
        {unclassified.campaigns.map((c) => (
          <li key={c.name}>
            {c.name} — {formatCurrency(c.spend)}
          </li>
        ))}
      </ul>
    </article>
  );
}
