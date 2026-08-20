---
title: "Mapa de repositórios por serviço de hospedagem"
product: processo
type: arquitetura
owner: "@Thiago Enge"
status: stable
updated: 2026-08-20
publish: true
summary: "Onde vive o código de cada coisa — GitHub tech-utua, GitHub be-growth ou Bitbucket tech-utua — e, quando há cópia em mais de um lugar, qual delas é a viva."
audience: "Engenharia"
nav_title: "Mapa de repositórios"
nav_order: 60
---

<!-- gerado por utua-docs · réplica read-only · não edite aqui -->

# Mapa de repositórios por serviço de hospedagem

> O código da UTUA está espalhado por **três endereços**, e 50 nomes de repositório
> aparecem em mais de um deles. Esta página diz onde procurar, qual cópia é a viva e
> quais frentes ainda dependem do Bitbucket.

## A resposta curta

| Serviço | Repos | Ativos em 2026 | O que vive aqui |
|---|---:|---:|---|
| **GitHub `tech-utua`** | 89 | 85 | O padrão. Todo projeto novo nasce aqui. É onde está o desenvolvimento corrente. |
| **GitHub `be-growth`** | 92 | 12 | Plataforma/infra (`platform-*`, `handbook-*`, Terraform, Helm) e um acervo grande de legado BeGrowth parado desde 2022-2024. |
| **Bitbucket `tech-utua`** | 123 | 38 * | Legado. Ainda é fonte de verdade para WordPress, front-admin, Magic Ads e alguns serviços — o resto é espelho ou está desativado. |

Nenhum repositório existe nos três ao mesmo tempo.

<small>\* Fora do projeto <code>archived</code> do Bitbucket. Os 53 repos daquele projeto também aparecem com <code>updated_on</code> de 2026 na API, mas a data é a do próprio arquivamento em maio/2026 — não de código novo.</small>

:::atencao Projeto novo vai para o GitHub tech-utua
Bitbucket é legado e não recebe repositório novo. `be-growth` é a org da Plataforma —
só entre lá se o trabalho for de infra compartilhada.
:::

## Onde procurar o código de X

1. **`gh repo list tech-utua`** — resolve a maioria dos casos.
2. Não achou? **`gh repo list be-growth`** — se for infra, IaC, handbook ou SDK antigo.
3. Ainda não achou? **Bitbucket `tech-utua`** — se for WordPress, front-admin, Magic Ads
   ou algo anterior a 2026.
4. Achou em **dois** lugares? Não presuma que o GitHub é o certo. Vá para a
   [tabela de cópias](#copias-o-mesmo-nome-em-dois-servicos) abaixo.

## O que ainda é fonte de verdade no Bitbucket

Estes repositórios **não têm equivalente vivo no GitHub**. Mexer neles é mexer no
Bitbucket.

| Repositório | Último commit | O que é |
|---|---|---|
| `front-utua-admin` | 2026-08-20 | Front admin — o repo mais ativo de todo o inventário. A cópia em `be-growth` parou em 2025-04. |
| `wp-utua` | 2026-08-13 | WordPress do utua.com.br. Deploy por tag. |
| `wp-clones` | 2026-08-11 | Multisite dos clones (Ad Inserter, Magic Ads). |
| `wp-jornaldecartao` | 2026-07-07 | WordPress do Jornal do Cartão. |
| `front-utua-affiliation` | 2026-07-23 | Front de afiliação. |
| `conversion-pipeline` | 2026-05-04 | Pipeline de conversão. O desdobramento em serviços já está no GitHub. |
| `service-clube-utua-key-values` | 2026-04-24 | Key-values do Clube. |
| `vbuilder` | 2026-04-01 | Builder do app. |
| `data-utua-glockapps-spam-test` | 2026-03-23 | Teste de spam GlockApps. Não confundir com `data-utua-glockapps`, que é outro repo. |
| `service-utua-admin-magicads-*` (7 repos) | 2025-12 a 2026-06 | Microserviços do Magic Ads: adunit, bq, log, page, reader, rule-history, zone. Só o gam-page-inserter tem cópia — em `be-growth`, desatualizada. |
| `service-mail-verify`, `service-verify-consumer` | 2025-09 | Verify legado. O refactor vivo está em `tech-utua`. |
| `front-calcule-utua`, `front-unsub-wpp`, `front-utua-pages-wp` | 2025 | Fronts dormentes sem par no GitHub. |
| `component-library-css-modules`, `component-library-tailwind` | 2025-09 | POCs de biblioteca de componentes. |
| `data-utua-*` (20 repos) | 2025-06-04 | Funções de dados congeladas no mesmo dia. Só airflow, nfse_send_email e nfse_download_transform migraram. |

## Cópias: o mesmo nome em dois serviços

**37 repositórios** existem com o mesmo nome no GitHub `tech-utua` e no Bitbucket, e
**12** entre `be-growth` e Bitbucket. Na esmagadora maioria o GitHub venceu — mas há
exceções que custam caro.

### Divergência real: commits que só existem no Bitbucket

:::perigo Dois repositórios migrados continuaram recebendo commit no Bitbucket
Os commits abaixo **não existem no GitHub**. Como o CI/CD desses dois projetos foi
repontado para o GitHub em 2026-07-24, esse trabalho não está deployado — e um deploy
a partir do GitHub o desfaria.
:::

| Repositório | Órfãos | O que ficou para trás |
|---|---:|---|
| `front-utua-chat` | 9 commits | HEAD do Bitbucket `b4ee15c` (2026-07-29, favicon do Modelo 2) contra `65780aa` (2026-07-15) no GitHub. Deploy: Cloudflare Pages, a partir do GitHub. |
| `wp-site-cloner` | 1 commit | `49aebc8` (2026-08-05) — `fix(ad-inserter): normalizar ad unit por forma`. Deploy: Cloud Build `wp-site-cloner-deploy-gh`, branch `main` do **GitHub**. |

O caminho de correção é o mesmo nos dois: trazer os commits do Bitbucket por PR no
GitHub, validar o build e só então tratar o Bitbucket como read-only.

### Bitbucket à frente por diferença de branch default

Nestes o HEAD do Bitbucket **existe** no GitHub, só não é a ponta da branch default de
lá. Não há perda de código, mas o `git clone` traz um estado diferente do esperado.

| Repositório | Bitbucket | GitHub (branch default) |
|---|---|---|
| `mobile-quiz-utua` | `a1389bd` · 2026-04-28 | `6b3eed5` · 2025-01-06 (default = `quiz-stage`) |
| `utua-go-template` | `3a905fd` · 2026-03-10 | `4dcf68f` · 2025-04-22 |
| `utua-k6-automation` | `e71822f` · 2025-11-05 | `62bf676` · 2025-09-17 |

### Espelhos idênticos

Mesmo SHA nos dois lados. São o resultado limpo da migração de 2026-07-16 — o Bitbucket
existe só como rollback.

`front-quiz-static` · `quizbuilder-backend` · `service-quizbuilder-html-offerwall` ·
`service-tiktok-events` · `mobile-packages` · `clones-frontend` ·
`script-utua-upload-to-clevertap` · `service-quizcontrol-template`

### GitHub à frente

Os outros 27 pares estão com o GitHub como ponta viva e o Bitbucket parado —
inclusive todos os `service-*` de Go, `service-chat`, `service-wordpress`,
`quiz-builder`, `quizbuilder-frontend`, `chat-widget-dashboard`, `gtg-proxy`.
Nesses casos, **use o GitHub e ignore o Bitbucket**.

Entre `be-growth` e Bitbucket, o Bitbucket ganha em 8 dos 12 pares — incluindo
`front-utua-admin`, `wp-utua`, `wp-clones` e `wp-jornaldecartao`. A exceção relevante é
`conversion-analytics-sdk`, vivo em `be-growth` (2026-06-03).

## Falsos positivos: repos que parecem vivos e estão vazios

Aparecem com `updated_on` recente na API do Bitbucket porque foram movidos de projeto,
mas têm **zero commits**. O código, quando existe, está só na máquina de alguém ou
direto no runtime.

| Repositório | Onde o código realmente está |
|---|---|
| `api-contracts` | Contratos OpenAPI da Central do Colaborador — nunca pushados. |
| `worker-geolocation-headers` | Worker `geolocation-headers` na conta Cloudflare BG, deploy direto por `wrangler`. |
| `cloudflare-geolocation-worker` | Mesmo caso — dois repos vazios para o mesmo worker. |
| `translation-service` | Sem fonte versionada. |

## Nomes parecidos que não são a mesma coisa

- `data-utua-glockapps` (GitHub) **≠** `data-utua-glockapps-spam-test` (Bitbucket).
- `service-key-value-gam` (GitHub) **≠** `service-key-values-gam` (be-growth)
  **≠** `service-clube-utua-key-values` (Bitbucket).
- `worker-geolocation-headers` **≠** `cloudflare-geolocation-worker` — os dois vazios.
- `service-mail-verify-refactor` existe nos dois GitHubs: `be-growth` parou em 2022,
  `tech-utua` é o vivo (2026-08-12).
- `front-utua-chat`, `front-utua-chat-v2` e `front-utua-chat-proxy` são três repos
  distintos, todos em `tech-utua`.

## Inventário por serviço

### GitHub `tech-utua` — 89 repos

**Ativos (push desde junho/2026), por prefixo:**

- **front-** — `front-central-colaborador`, `front-gam-dashboard`,
  `front-portal-suporte-utua`, `front-quiz-static`, `front-utua-chat`,
  `front-utua-chat-proxy`, `front-utua-chat-v2`
- **service-** — `service-ads-experiments`, `service-ads-platform`,
  `service-central-colaborador-api`, `service-chat`, `service-chat-agent`,
  `service-chat-agent-cf-proxy`, `service-cloudflare-zone-sync`, `service-clube-utua-ai`,
  `service-clube-utua-import`, `service-clube-utua-monolith`,
  `service-conversion-pipeline-admin`, `service-conversion-pipeline-collector`,
  `service-conversion-pipeline-collector-worker`, `service-conversion-pipeline-dispatcher`,
  `service-conversion-pipeline-finalizer`, `service-findbgidbyphone`,
  `service-gam-dashboard`, `service-magic-ads-monolith`, `service-mail-verify-refactor`,
  `service-quiz-router`, `service-quizbuilder-html-offerwall`, `service-tiktok-events`,
  `service-utua-admin-clean-quiz`, `service-utua-auth`, `service-wordpress`
- **quiz** — `quiz-builder`, `quizbuilder-backend`, `quizbuilder-frontend`
- **platform-** — `platform-argocd-apps`, `platform-argocd-devops`, `platform-iac`,
  `platform-migration-map`
- **utua-** — `utua-content-builder`, `utua-docs`, `utua-news`, `utua-quizzes`,
  `utua-workspace`
- **mobile-** — `mobile-clube-utua`, `mobile-quiz-utua`
- **data-** — `data-utua-airflow`, `data-utua-nfse_send_email`
- **outros** — `acquisition-context`, `acquisition-hub`, `analytics-next`,
  `automonet-data-provider`, `chat-widget-dashboard`, `conversion-analytics`,
  `cortex-sinapse`, `gam_dashboard`, `growthcontrol-clevertap-unsub`, `gtg-proxy`,
  `jarvis`, `monet-automonetization`, `people-hub`, `sao-backend`, `sao-frontend`,
  `support-context`, `talentflow`, `team-audit`, `worker-func-verify-email`,
  `wp-site-cloner`

**Dormentes (último push antes de junho/2026):** `data-utua-glockapps`,
`data-utua-nfse_download_transform`, `github-actions`, `mobile-packages`,
`service-affiliate`, `service-chat-rating`, `service-key-value-gam`,
`service-mail-consumer-refactor`, `service-mail-summarizer`, `service-takeover`,
`service-utua-admin-user`, `service-utua-affiliation`, `service-utua-fingerprint`,
`utua-commons`, `utua-deeplink`, `utua-go-template`, `utua-k6-automation`,
`utua-protobuf-contracts`.

**Arquivados (read-only):** `quiz-builder-api` (consolidado em `quiz-builder`),
`utua-ai-docs`, `utua-skills` (a skill `conversion-analytics-guide` foi para
`utua-workspace` antes do arquivamento).

### GitHub `be-growth` — 92 repos, 12 vivos

`platform-docs` · `handbook-qa` · `d1-rest` · `platform-workspace` ·
`platform-helm-charts` · `handbook-it` · `service-mail-verify-refactor` (morto aqui) ·
`platform-roadmap` · `platform-work-log` · `platform-terraform-modules` ·
`conversion-analytics-sdk` · `dbt_utua-data-prd`.

Os outros 80 estão parados desde 2022-2025: POCs (`poc-creative-builder`,
`poc-widget-chat-*`), `looker-*` (9 repos), `service-assiny-*`, `service-raffle*`,
`unsubscribe-*`, `front-*` antigos e o acervo `infra-aws` / `infra-k8s`.

:::atencao d1-rest mora em be-growth, não em tech-utua
É a única dependência do ecossistema de quiz fora da org principal. O `manifest.yml`
do utua-docs já registra isso com `org: be-growth`.
:::

### Bitbucket `tech-utua` — 123 repos

**53** estão no projeto `archived` — desativados em maio/2026, entre eles toda a família
`service-quizcontrol-*` (10 repos), `service-utua-vaquinha-*` (6) e `service-takeover-*` (3).

Dos **70** restantes, só as frentes listadas em
[O que ainda é fonte de verdade no Bitbucket](#o-que-ainda-e-fonte-de-verdade-no-bitbucket)
importam. O resto é espelho de repositório que já vive no GitHub.

Projetos do Bitbucket, por tamanho: `archived` (53), `UTUA Data` (24), `UTUA Admin` (13),
`magic-ads` (8), `Utua Wp` (5), `Unsub Wpp` (3), `Quiz` (3), `Clube Utua` (3),
`Verify` (2), `component-library-poc` (2), e sete projetos de um repo cada.

## Divergências com o `manifest.yml`

O `manifest.yml` do utua-docs marca cinco repositórios como `provider: bitbucket,
status: pending` que **já estão no GitHub** desde 2026-07-16: `quizbuilder-backend`,
`front-quiz-static`, `service-quizbuilder-html-offerwall`, `service-tiktok-events` e
`wp-site-cloner`. A réplica de docs não roda neles por causa disso.

`front-utua-admin`, `wp-utua`, `wp-clones`, `wp-jornaldecartao` e
`worker-geolocation-headers` continuam corretamente marcados como `pending`.

## Como reproduzir este mapa

```bash
# GitHub — as duas orgs
gh repo list tech-utua --limit 300 --json name,isArchived,pushedAt,defaultBranchRef > gh.json
gh repo list be-growth --limit 300 --json name,isArchived,pushedAt,defaultBranchRef > bg.json

# Bitbucket — paginado, auth por app password
curl -su "$BITBUCKET_APP_USERNAME:$BITBUCKET_APP_PASSWORD" \
  "https://api.bitbucket.org/2.0/repositories/tech-utua?pagelen=100&sort=-updated_on"

# Qual cópia é a viva: comparar o SHA da ponta dos dois lados
gh api repos/tech-utua/<repo>/commits/main --jq '.sha[0:7]'
curl -su "$BITBUCKET_APP_USERNAME:$BITBUCKET_APP_PASSWORD" \
  "https://api.bitbucket.org/2.0/repositories/tech-utua/<repo>/commits?pagelen=1" \
  | jq -r '.values[0].hash[0:7]'

# Commit do Bitbucket é órfão? 422 = não existe no GitHub
gh api repos/tech-utua/<repo>/commits/<sha-do-bitbucket>
```

:::atencao Esta página tem prazo de validade
Os números são de **2026-08-20**. `front-utua-admin` recebe commit quase todo dia e a
migração Bitbucket→GitHub segue em curso — reconfira antes de decidir com base nas
contagens.
:::

## Referências

- `manifest.yml` do utua-docs — mapeamento produto → repositório → provider.
- `repos.txt` do `tech-utua/utua-workspace` — repos clonados pelo `make bootstrap`
  (só GitHub `tech-utua`).
- [Guia de Codebase AI-Ready](/processo/ai-ready-codebase/) — o padrão que os repos
  precisam atingir.
