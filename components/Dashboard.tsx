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
import type { BlockResult, CampaignDisplayRow, HealthLevel } from "@/lib/aggregate";

interface Totals {
  spend: number;
  impressions: number;
  reach: number;
}

interface ApiError {
  kind: "auth" | "network" | "unexpected_shape" | "rate_limit" | "unknown";
  message: string;
}

interface DataResponse {
  period: PeriodPreset;
  range: { start: string; end: string };
  comparisonRange: { start: string; end: string };
  isPartial: boolean;
  hasAnyData: boolean;
  accumulatedSpend: number | null;
  accumulatedRange: { start: string; end: string };
  accumulatedError: ApiError | null;
  totals: Totals;
  totalsComparison: Totals;
  blocks: BlockResult[];
  campaigns: CampaignDisplayRow[];
  generatedAt: string;
}

interface ErrorResponse {
  error: ApiError;
}

const PRESETS: PeriodPreset[] = ["today", "3", "7", "14"];

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

const HEALTH_ICON: Record<HealthLevel, string> = {
  ok: "🟢",
  watch: "🟡",
  alert: "🔴",
};

export default function Dashboard() {
  const [period, setPeriod] = useState<PeriodPreset>("7");
  const [data, setData] = useState<DataResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/data?period=${period}`, { cache: "no-store" });
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
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  }

  const periodLabel = PERIOD_LABELS[period];

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

      <AccumulatedBar
        spend={data?.accumulatedSpend ?? undefined}
        range={data?.accumulatedRange}
        hasError={!!data?.accumulatedError}
        loading={loading}
      />

      {data?.isPartial && (
        <p className="partial-warning">
          Dado parcial de hoje — a veiculação ainda está em andamento e os números vão mudar ao longo do dia.
        </p>
      )}

      {loading && <LoadingState />}

      {!loading && error && <ErrorState error={error} onRetry={() => load()} />}

      {!loading && !error && data && !data.hasAnyData && (
        <EmptyState range={data.range} periodLabel={periodLabel} />
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

          <CreativeHealthSummary campaigns={data.campaigns} />

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
  hasError,
  loading,
}: {
  spend?: number;
  range?: { start: string; end: string };
  hasError: boolean;
  loading: boolean;
}) {
  const value = loading
    ? "—"
    : hasError
      ? "indisponível"
      : spend === undefined
        ? "—"
        : formatCurrency(spend);

  return (
    <section className="accumulated-bar">
      <div>
        <span className="accumulated-label">Gasto acumulado da campanha</span>
        <span className="accumulated-hint">
          {hasError
            ? "Não foi possível calcular agora — tente recarregar em alguns instantes."
            : range
              ? `Desde ${formatDateBR(range.start)} — controle para prestação de contas`
              : "Carregando…"}
        </span>
      </div>
      <span className="accumulated-value">{value}</span>
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

function CreativeHealthSummary({ campaigns }: { campaigns: CampaignDisplayRow[] }) {
  const alerts = campaigns.filter((c) => c.health.level === "alert");
  const watch = campaigns.filter((c) => c.health.level === "watch");

  if (alerts.length === 0 && watch.length === 0) {
    return (
      <section className="health-summary health-summary-ok">
        <div className="health-summary-ok-row">
          <span className="health-summary-icon">🟢</span>
          <p>Nenhuma campanha pedindo troca de criativo neste período — frequência e custo por resultado dentro do esperado.</p>
        </div>
        <HealthLegend />
      </section>
    );
  }

  return (
    <section className="health-summary health-summary-alert">
      <h2 className="section-title">Saúde dos criativos</h2>
      {alerts.length > 0 && (
        <ul className="health-summary-list">
          {alerts.map((c, i) => (
            <li key={`${c.name}-${i}`} title={c.health.reason}>
              <span className="health-summary-icon">{HEALTH_ICON.alert}</span>
              <strong>{c.name}</strong> — {c.health.label}
            </li>
          ))}
        </ul>
      )}
      {watch.length > 0 && (
        <ul className="health-summary-list">
          {watch.map((c, i) => (
            <li key={`${c.name}-${i}`} title={c.health.reason}>
              <span className="health-summary-icon">{HEALTH_ICON.watch}</span>
              <strong>{c.name}</strong> — {c.health.label}
            </li>
          ))}
        </ul>
      )}
      <HealthLegend />
    </section>
  );
}

function HealthLegend() {
  return (
    <details className="health-legend">
      <summary>Como funciona esse selo?</summary>
      <p>
        Cruza 3 números: frequência semanal (quantas vezes em média a mesma pessoa viu o anúncio), CPM comparado
        com as outras campanhas do mesmo bloco, e a variação do custo por resultado em relação ao período
        anterior.
      </p>
      <ul>
        <li>
          <strong>🟢 Manter</strong> — frequência até 6x/semana, CPM até 30% acima da média do bloco, custo por
          resultado estável.
        </li>
        <li>
          <strong>🟡 Observar</strong> — frequência entre 6 e 8x/semana, ou CPM entre 30% e 60% acima da média do
          bloco, ou custo por resultado subiu entre 15% e 25%.
        </li>
        <li>
          <strong>🔴 Trocar/Desligar</strong> — frequência acima de 8x/semana, ou (frequência acima de 6x/semana
          e custo por resultado subiu mais de 25%), ou (CPM 60%+ acima da média do bloco e custo subiu mais de
          25%).
        </li>
      </ul>
      <p className="health-legend-note">
        A comparação de custo só entra quando a campanha já tinha gasto pelo menos R$ 50 no período anterior —
        campanha muito nova (1-2 dias de rampa) tem custo artificialmente baixo e isso distorceria a conta.
      </p>
    </details>
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
            <th title="Frequência semanal + CPM relativo ao bloco + custo por resultado vs. período anterior">Criativo</th>
            <th>Gasto</th>
            <th>Impressões</th>
            <th>Alcance</th>
            <th>Resultados</th>
            <th>Custo/Result.</th>
            <th>Frequência</th>
            <th>CTR</th>
            <th>CPC</th>
            <th>CPM</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c, i) => (
            <tr key={`${c.name}-${i}`}>
              <td className="campaign-name-cell">
                <span className={`badge badge-${c.blockId}`}>{BADGE_LABEL[c.blockId]}</span>
                {c.name}
              </td>
              <td className={`health-cell health-cell-${c.health.level}`} title={c.health.reason}>
                {HEALTH_ICON[c.health.level]} {c.health.label}
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
              <td>{c.frequency.toFixed(2)}</td>
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
      : error.kind === "rate_limit"
        ? "O Reportei limitou as chamadas por alguns instantes (limite compartilhado com outros paineis da agência). Aguarde um pouco e tente novamente."
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
