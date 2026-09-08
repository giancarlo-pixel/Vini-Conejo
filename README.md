# Dashboard Meta Ads — Dr. Vinícius Conejo

Dashboard de performance de Meta Ads da campanha eleitoral de Dr. Vinícius
Conejo, com dados vindos do Reportei (API v2).

## O que este projeto mostra

- **Gasto acumulado da campanha** — faixa no topo, desde 16/08/2026 (início
  da janela eleitoral), para controle de teto de gastos.
- **Chama o Doutor (WhatsApp)** — conversas iniciadas, em destaque.
- **Engajamento** — interações com publicações.
- **Reconhecimento / Alcance** — pessoas alcançadas, custo em CPM.
- **Não classificadas** — alarme visível para campanhas fora do padrão de
  nome (nunca some silenciosamente).
- Seletor de período Hoje/7/14/30 dias (dias sempre terminam ontem) com
  comparação ao período anterior.
- Estado vazio tratado como tela de primeira classe (a campanha ainda não
  começou a rodar) e distinto de um erro real de conexão/token.
- Exportação em PDF pelo print nativo do navegador.

## Passo a passo para rodar localmente (Mac)

Abra o Terminal, entre na pasta do projeto e rode cada comando abaixo, um de
cada vez.

1. **Instalar as dependências** (baixa tudo que o projeto precisa):
   ```
   npm install
   ```
2. **Criar o arquivo de variáveis de ambiente** copiando o exemplo:
   ```
   cp .env.local.example .env.local
   ```
   Depois abra `.env.local` num editor de texto e preencha:
   - `REPORTEI_TOKEN` — gere um token **novo e exclusivo** deste dashboard em
     `app.reportei.com → Configurações da empresa → API Reportei`. **Não
     apague nem edite o token "MCP OAuth - Claude"** nessa mesma tela.
   - `DASHBOARD_PASSWORD` — a senha que a equipe vai usar para acessar o
     dashboard.
   Esse arquivo nunca sobe para o Git (já está no `.gitignore`).
3. **Rodar em modo desenvolvimento**:
   ```
   npm run dev
   ```
   Abra `http://localhost:3000` no navegador. Como a campanha ainda não
   rodou nenhum anúncio, é esperado ver o estado vazio — isso é normal.

## Deploy na Vercel

1. `vercel` — faz o primeiro deploy e liga a pasta ao seu projeto Vercel.
2. Configurar as variáveis de ambiente na Vercel (uma vez só):
   ```
   vercel env add REPORTEI_TOKEN production
   vercel env add DASHBOARD_PASSWORD production
   ```
   Quando perguntar, marque como **sensitive: yes**.
3. `vercel --prod` — publica a versão de produção.
4. Compartilhe o link **"Aliased"** (o link limpo, sem o hash de deploy) e a
   senha só com a equipe.

## Pendências antes de ir ao ar

- [ ] **Cor da marca (hex oficial da AKAHUB)** — o dashboard está usando uma
  paleta neutra provisória em `lib/config.ts` (`BLOCK_COLORS`). Assim que o
  cliente enviar os hex oficiais, troque só esses valores.
- [ ] Senha definida em `DASHBOARD_PASSWORD`.
- [ ] Token novo do Reportei gerado e salvo no `.env.local` / na Vercel.
- [ ] Quando as campanhas subirem: validar os números contra o Gerenciador
  de Anúncios da Meta e conferir os `title` reais retornados em `results` —
  complete `RESULT_TITLE_TRANSLATIONS` em `lib/config.ts` se aparecer algum
  rótulo novo.

## Estrutura do projeto

```
lib/config.ts          — IDs do Reportei, mapa TIPO->bloco, traduções, cores
lib/dates.ts            — presets de período (Sao Paulo timezone)
lib/reportei.ts         — cliente da API v2, catálogo, parsing defensivo
lib/aggregate.ts        — classificação de campanhas e agregação por bloco
lib/auth.ts              — senha e cookie de acesso
lib/format.ts            — formatação de moeda/número em pt-BR
middleware.ts            — protege todas as rotas exceto /login
app/api/data/route.ts   — busca e agrega os dados por bloco
app/api/auth/route.ts   — validação da senha
app/page.tsx             — dashboard (via components/Dashboard.tsx)
app/login/page.tsx       — tela de acesso
app/globals.css          — estilos + CSS de impressão
```

## Escopo de dados

Projeto Reportei `1261706` (Dr Vinicius Conejo), integração `3747630`
(`act_1637839791031333` — "CAMPANHA - Vinicius Conejo" no Gerenciador de
Anúncios da Meta; aparece como "CAMPANHA 2 - Vinicius Conejo" no Reportei).
Confirmado com o cliente em 08/09/2026 como a conta que está rodando a
campanha. Existe uma segunda integração no mesmo projeto (`3747629` /
`act_26862321646750483`) que fica **fora do escopo** e nunca é consultada.
