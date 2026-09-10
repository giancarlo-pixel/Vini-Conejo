"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BLOCK_COLORS,
  CANDIDATE_NUMBER,
  DASHBOARD_EYEBROW,
  DASHBOARD_TITLE,
  PERIOD_LABELS,
  REPORTEI_ACCOUNT_ID,
  type PeriodPreset,
} from "@/lib/config";
import { formatCurrency, formatDelta, formatNumber, formatPercent } from "@/lib/format";
import { formatDateBR } from "@/lib/dates";
import type { BlockResult, CampaignDisplayRow } from "@/lib/aggregate";

interface Totals {
  spend: number;
  impressions: number;
  reach: number;
}

interface DataResponse {
  period: PeriodPreset;
  range: { start: string; end: string };
  comparisonRange: { start: string; end: string };
  isPartial: boolean;
  hasAnyData: boolean;
  accumulatedSpend: number;
  accumulatedRange: { start: string; end: string };
  totals: Totals;
  totalsComparison: Totals;
  blocks: BlockResult[];
  campaigns: CampaignDisplayRow[];
  generatedAt: string;
}

interface ErrorResponse {
  error: { kind: "auth" | "network" | "unexpected_shape" | "unknown"; message: string };
}

const PRESETS: PeriodPreset[] = ["today", "7", "14", "30"];

const BLOCK_NOTES: Record<string, string> = {
  engajamento: "Investimento em presença de marca, não é resultado de negócio direto.",
  reconhecimento: "Alcance somado entre campanhas do período — pode haver sobreposição de pessoas.",
  video: "Campanhas sem token de TIPO no nome — hoje é o padrão da conta (foco em reprodução de vídeo).",
};

const BADGE_LABEL: Record<string, string> = {
  engajamento: "ENG",
  reconhecimento: "REC",
  video: "VÍDEO",
};

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
      <header className="hero">
        <div className="hero-top">
          <div>
            <p className="hero-eyebrow">{DASHBOARD_EYEBROW}</p>
            <h1>{DASHBOARD_TITLE}</h1>
          </div>
          <div className="hero-number-block no-print">
            <span className="hero-number">{CANDIDATE_NUMBER}</span>
            {data && (
              <span className="hero-number-range">
                {formatDateBR(data.range.start)} – {formatDateBR(data.range.end)}
              </span>
            )}
          </div>
        </div>

        <div className="hero-controls no-print">
          <div className="period-selector">
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
          <button className="btn-ghost" onClick={() => window.print()}>
            Exportar PDF
          </button>
          <button className="btn-ghost" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      <AccumulatedBar spend={data?.accumulatedSpend} range={data?.accumulatedRange} loading={loading} />

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
          <div className="kpi-grid">
            <KpiCard label="Investimento" value={formatCurrency(data.totals.spend)} current={data.totals.spend} previous={data.totalsComparison.spend} />
            <KpiCard label="Impressões" value={formatNumber(data.totals.impressions)} current={data.totals.impressions} previous={data.totalsComparison.impressions} />
            <KpiCard
              label="Alcance"
              value={formatNumber(data.totals.reach)}
              current={data.totals.reach}
              previous={data.totalsComparison.reach}
              hint="Soma entre campanhas — quem foi atingido mais de uma vez não é público único."
            />
          </div>

          <ObjectiveBreakdown blocks={data.blocks} />

          <section className="account-section">
            <h2 className="account-title">
              {"CAMPANHA - Vinicius Conejo"} <span className="account-id">{REPORTEI_ACCOUNT_ID}</span>
            </h2>
            <CampaignTable campaigns={data.campaigns} />
          </section>
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

function KpiCard({
  label,
  value,
  current,
  previous,
  hint,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  hint?: string;
}) {
  const delta = formatDelta(current, previous);
  return (
    <article className="kpi-card">
      <span className="kpi-label">{label}</span>
      <div className="kpi-value-row">
        <span className="kpi-value">{value}</span>
        {delta.pct !== null && (
          <span className={`delta delta-${delta.direction}`}>
            {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "—"} {Math.abs(delta.pct).toFixed(1)}%
          </span>
        )}
      </div>
      {hint && <p className="kpi-hint">{hint}</p>}
    </article>
  );
}

function ObjectiveBreakdown({ blocks }: { blocks: BlockResult[] }) {
  const totalSpend = blocks.reduce((sum, b) => sum + b.spend, 0);
  const segments = blocks.filter((b) => b.spend > 0);

  return (
    <section className="objective-section">
      <h2 className="section-title">Divisão do investimento por objetivo</h2>

      {totalSpend > 0 && (
        <div className="objective-bar">
          {segments.map((b) => (
            <div
              key={b.id}
              className="objective-bar-segment"
              style={{
                flexGrow: b.spend,
                background: BLOCK_COLORS[b.id].light,
              }}
            />
          ))}
        </div>
      )}

      <div className="objective-cards">
        {blocks.map((block) => (
          <ObjectiveCard
            key={block.id}
            title={block.label}
            spend={block.spend}
            resultValue={block.primaryMetricValue}
            resultLabel={block.primaryMetricLabel}
            costPerResult={block.costPerResult}
            costMode={block.costMode}
            note={BLOCK_NOTES[block.id]}
          />
        ))}
      </div>
    </section>
  );
}

function ObjectiveCard({
  title,
  spend,
  resultValue,
  resultLabel,
  costPerResult,
  costMode,
  note,
}: {
  title: string;
  spend: number;
  resultValue: number | null;
  resultLabel: string;
  costPerResult: number | null;
  costMode: "per_result" | "cpm";
  note?: string;
}) {
  const costHint = costPerResult !== null ? (costMode === "cpm" ? `R$ ${costPerResult.toFixed(2)} por mil` : formatCurrency(costPerResult)) : null;

  return (
    <article className="objective-card">
      <h3>{title}</h3>
      <span className="objective-card-value">{formatCurrency(spend)}</span>
      <p className="objective-card-secondary">
        {resultValue !== null ? `${formatNumber(resultValue)} ${resultLabel}` : resultLabel}
        {costHint && <> · {costHint}</>}
      </p>
      {note && <p className="objective-card-note">{note}</p>}
    </article>
  );
}

function CampaignTable({ campaigns }: { campaigns: CampaignDisplayRow[] }) {
  if (campaigns.length === 0) return null;
  return (
    <div className="table-scroll">
      <table className="campaign-table">
        <thead>
          <tr>
            <th>Campanha</th>
            <th>Gasto</th>
            <th>Impressões</th>
            <th>Alcance</th>
            <th>Resultados</th>
            <th>Custo/Result.</th>
            <th>CTR</th>
            <th>CPC</th>
            <th>CPM</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.name}>
              <td className="campaign-name-cell">
                <span className={`badge badge-${c.blockId}`}>{BADGE_LABEL[c.blockId]}</span>
                {c.name}
              </td>
              <td>{formatCurrency(c.spend)}</td>
              <td>{formatNumber(c.impressions)}</td>
              <td>{formatNumber(c.reach)}</td>
              <td>
                {c.resultValue !== null ? (
                  <>
                    <div>{formatNumber(c.resultValue)}</div>
                    <div className="table-subtext">{c.resultLabel}</div>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td>{c.costPerResult !== null ? formatCurrency(c.costPerResult) : "—"}</td>
              <td>{formatPercent(c.ctr)}</td>
              <td>{formatCurrency(c.cpc)}</td>
              <td>{formatCurrency(c.cpm)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadingState() {
  return <div className="state-panel state-loading">Carregando dados do Reportei…</div>;
}

function ErrorState({ error, onRetry }: { error: ErrorResponse["error"]; onRetry: () => void }) {
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
