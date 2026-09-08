// Escopo fixo da integracao Reportei usada por este dashboard.
// Confirmado com o cliente em 08/09/2026: a conta que esta rodando a
// campanha e a act_1637839791031333 ("CAMPANHA - Vinicius Conejo" no
// Gerenciador de Anuncios da Meta; aparece como "CAMPANHA 2 - Vinicius
// Conejo" no Reportei). A outra integracao do mesmo projeto (3747629 /
// act_26862321646750483) fica FORA do escopo e nunca deve ser consultada.
export const REPORTEI_PROJECT_ID = 1261706;
export const REPORTEI_INTEGRATION_ID = 3747630;
export const REPORTEI_INTEGRATION_SLUG = "facebook_ads";
export const REPORTEI_ACCOUNT_ID = "act_1637839791031333";

// Propaganda eleitoral paga so e permitida a partir de 16/08 do ano eleitoral.
// Usado como inicio da janela de "gasto acumulado da campanha".
export const CAMPAIGN_WINDOW_START_DATE = "2026-08-16";

export type BlockId = "whatsapp" | "engajamento" | "reconhecimento";

export const UNCLASSIFIED_BLOCK_ID = "nao_classificadas" as const;

interface BlockConfig {
  id: BlockId;
  order: number;
  label: string;
  shortLabel: string;
  description: string;
  /** "Investimento em presenca de marca" ou resultado de negocio real */
  isBrandInvestment: boolean;
  /** Como o "custo por resultado" deste bloco deve ser calculado e rotulado */
  costMode: "per_result" | "cpm";
  costLabel: string;
}

// Mapa TIPO -> bloco. O token [TIPO] no nome da campanha decide o bloco.
// Ajustavel aqui sem tocar no restante do codigo.
export const TIPO_TO_BLOCK: Record<string, BlockId> = {
  WPP: "whatsapp",
  ENG: "engajamento",
  REC: "reconhecimento",
};

export const BLOCKS: Record<BlockId, BlockConfig> = {
  whatsapp: {
    id: "whatsapp",
    order: 1,
    label: "Chama o Doutor (WhatsApp)",
    shortLabel: "Chama o Doutor",
    description:
      "Conversas iniciadas pelo canal direto de WhatsApp da campanha. E o funil central e a unica metrica de conversao real.",
    isBrandInvestment: false,
    costMode: "per_result",
    costLabel: "Custo por conversa",
  },
  engajamento: {
    id: "engajamento",
    order: 2,
    label: "Engajamento",
    shortLabel: "Engajamento",
    description: "Interacoes com as publicacoes. Investimento em presenca de marca.",
    isBrandInvestment: true,
    costMode: "per_result",
    costLabel: "Custo por interacao",
  },
  reconhecimento: {
    id: "reconhecimento",
    order: 3,
    label: "Reconhecimento / Alcance",
    shortLabel: "Reconhecimento",
    description:
      "Pessoas alcancadas pela campanha. Investimento em presenca de marca.",
    isBrandInvestment: true,
    costMode: "cpm",
    costLabel: "Custo por mil impressoes (CPM)",
  },
};

export const BLOCK_ORDER: BlockId[] = ["whatsapp", "engajamento", "reconhecimento"];

// A Meta devolve o "title" do resultado em ingles. Traduzir para exibicao.
// Quando a veiculacao comecar, conferir os titles reais retornados em
// `results.title` / `cost_per_results.title` e completar esta tabela -
// e provavel que apareca algum rotulo nao previsto aqui.
export const RESULT_TITLE_TRANSLATIONS: Record<string, string> = {
  "Post Engagement": "Interações com a publicação",
  "Post Interaction Gross": "Interações com a publicação",
  Reach: "Pessoas alcançadas",
  "Messaging Conversations Started": "Conversas no Chama o Doutor",
  "Omni Landing Page View": "Visualizações da página",
  Thruplays: "Reproduções completas do vídeo",
};

export function translateResultTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  return RESULT_TITLE_TRANSLATIONS[title] ?? title;
}

// Periodos disponiveis no seletor. Os presets de dias terminam sempre ONTEM;
// "hoje" e o unico que mostra dado parcial.
export type PeriodPreset = "today" | "7" | "14" | "30";

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Hoje",
  "7": "7 dias",
  "14": "14 dias",
  "30": "30 dias",
};

// ---------------------------------------------------------------------------
// Identidade visual
//
// PENDENCIA: a cor da marca (hex oficial da campanha, definida pela agencia
// AKAHUB) ainda nao foi confirmada pelo cliente. NAO usar o laranja do NOVO
// nem o verde do PODEMOS por suposicao. As cores abaixo sao um placeholder
// neutro (paleta validada de acessibilidade) - troque os valores aqui assim
// que o cliente enviar os hex oficiais; nenhum outro arquivo precisa mudar.
// ---------------------------------------------------------------------------
export const BLOCK_COLORS: Record<BlockId, { light: string; dark: string }> = {
  whatsapp: { light: "#2a78d6", dark: "#3987e5" }, // azul - slot categorico 1
  engajamento: { light: "#1baf7a", dark: "#199e70" }, // aqua - slot categorico 3
  reconhecimento: { light: "#4a3aa7", dark: "#9085e9" }, // violeta - slot categorico 7
};

export const WARNING_COLOR = { light: "#fab219", dark: "#fab219" };
