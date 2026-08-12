---
title: "Guia de Codebase AI-Ready"
product: processo
type: arquitetura
owner: "@Thiago Enge"
status: stable
updated: 2026-08-12
source: https://tech-utua.atlassian.net/wiki/spaces/UTUA/pages/279019522
publish: true
summary: "Como estruturar nosso codigo para que humanos e agentes de IA trabalhem bem nele."
audience: "Engenharia"
nav_title: "Codebase AI-Ready"
---

# Guia de Codebase AI-Ready — UTUA

:::atencao Esta pagina e a fonte unica
O guia circulou em tres lugares desde junho: um arquivo no workspace do Thiago, a
pagina 279019522 do Confluence e copias soltas dentro de repos de quem seguiu a
instrucao "salve o guia no repositorio". Esta pagina passa a ser a unica fonte; as
outras viram ponteiro. A copia que aparece em `docs/` de cada repo e replica
gerada pela CI a partir daqui — nao edite la.

Conteudo escrito em 2026-06-10 e revisado em 2026-08-12. Para diagnosticar um
repositorio contra este guia, rode `/ai-ready-check` dentro dele.
:::

> Como estruturar nosso código para que humanos **e** agentes de IA trabalhem bem nele.
> Documento vivo. Sempre que uma prática evoluir, atualize aqui.

-----

## Por que este guia existe

As ferramentas de IA (Claude Code, Cursor) mudaram o gargalo do desenvolvimento. O custo agora não é digitar código — é **dar contexto** ao agente. Quanto mais espalhado e implícito for o código, mais o agente precisa ler para entender uma feature, mais caro fica (tokens), mais lento e mais ele alucina.

A tese central deste guia é simples:

> **Código organizado por feature autocontida + contratos explícitos + feedback machine-readable = a IA enxerga menos, erra menos e roda em paralelo sem se atrapalhar.**

Nada aqui exige reescrever o que já existe. A adoção é **incremental**: o novo nasce no padrão, o legado só migra quando já vamos mexer nele.

> ⚠️ **Princípios, não ferramentas.** As referências originais usam Bun, Biome, Pino e Drizzle. No nosso stack (Cloudflare Workers/D1 + Go + Next.js), adotamos os **princípios** (tooling rápido, log estruturado, tipos derivados de schema) — não as ferramentas literais. Bun não roda em Workers; em Workers, `console.log` de JSON + Workers Logs substitui Pino. Biome e Drizzle (que suporta D1) são adotáveis.

-----

## 1. A Camada de IA (CLAUDE.md)

Todo repositório tem duas camadas: o código, e a *camada de IA* — o contexto que ensina o agente a trabalhar naquele repo. Tratamos o `CLAUDE.md` como código de primeira classe.

### Hierarquia

- **`CLAUDE.md` na raiz de cada repo** (~60 linhas, conciso): stack, padrões de código, comandos de build/deploy, convenção de erros, o que NÃO fazer.
- **`CLAUDE.md` por feature** (quando adotarmos slices): regras locais curtas daquela fatia. Carregado só quando o agente trabalha ali.
- **Contexto sob demanda**: style guides e docs de referência ficam em arquivos separados, linkados, não inflando todo contexto.

### Governança ativa (regra de ouro)

Quando um agente gerar um padrão errado, **não corrija só o código** — mande o agente atualizar o `CLAUDE.md`:

```
"Atualize o CLAUDE.md para sempre formatar moeda com
Intl.NumberFormat usando locale e currency, nunca concatenação manual."
```

Assim a regra não se perde e o repo fica mais inteligente a cada correção.

### Exemplo de CLAUDE.md raiz (esqueleto UTUA)

```markdown
# CLAUDE.md — <produto>

## Stack
Next.js (App Router) · TypeScript · Cloudflare Workers/D1/R2/Pages · Strapi (CMS)

## Padrões
- Validação: sempre Zod. Schema na própria feature.
- Formatação: Intl.NumberFormat (locale/currency). Nunca string manual.
- Classes: clsx para condicional.
- Erros de API: sempre application/problem+json (ver seção 4).

## Comandos
- dev: `pnpm dev`
- check: `pnpm check`   ← lint + tsc --noEmit + test, num comando só
- deploy: tag-based (v[0-9]+.[0-9]+.[0-9]+)

## Não faça
- Não criar abstração "por precaução". Duplicação só vira shared/ quando comprovada.
- Não misturar lógica de transporte dentro de componentes React.
```

-----

## 2. Vertical Slice Architecture (VSA)

### O princípio

Organize por **caso de uso**, não por tipo técnico. Tudo que uma feature precisa mora na mesma pasta.

**Evite** (código espalhado por camada):

```
src/
├── controllers/quizController.ts
├── services/quizService.ts
├── repositories/quizRepository.ts
└── validators/quizValidator.ts
```

**Prefira** (feature autocontida):

```
src/features/save-answer/
├── index.ts              # API pública da fatia — único ponto de import externo
├── handler.ts            # rota / entrypoint
├── logic.ts              # regra de negócio
├── db.ts                 # acesso a dados (D1/R2)
├── schema.ts             # validação Zod
├── errors.ts             # erros da feature (classes próprias, ver seção 3)
├── claude.md             # regras locais da fatia (opcional)
└── save-answer.test.ts   # teste da feature
```

No backend Go, a fatia é simétrica: `internal/<caso-de-uso>/` com `handler.go` (implementa a interface gerada do contrato), `business.go` e `repository.go`.

Quando alguém (ou um agente) precisa mexer em `save-answer`, lê **uma pasta** e tem todo o contexto.

### Regras do time

1. **Toda feature nova nasce em `src/features/<caso-de-uso>/`.**
1. **`index.ts` é a fronteira.** Outra fatia só importa pelo `index.ts` — nunca direto do `db.ts`/`logic.ts` alheio. Sem essa fronteira, o isolamento (e o paralelismo de worktrees) erode com o tempo.
1. **Não reescrever legado.** Use *strangler*: ao tocar numa feature antiga, extraia só ela para um slice; deixe o resto quieto.
1. **`shared/` é disciplinada.** Só entra ali o que tem **duplicação comprovada** (drivers de banco, middleware de auth, helpers genuinamente genéricos). Nunca abstração preventiva.
1. **Componente React não contém transporte.** UI renderiza e captura interação; a chamada de API vive na fatia.

### Por que ajuda a IA

- **Menos token / menos alucinação**: o escopo da tarefa cabe numa pasta.
- **Paralelismo real**: 3-4 features em pastas diferentes = 3-4 agentes (ou `git worktree`) sem conflito de merge.
- **Teste localizado**: cada fatia testa a si mesma, ponta a ponta.

-----

## 3. Feedback loop machine-readable

A outra metade da tese: **a IA lê mensagem de erro como documentação**. Slice resolve *onde* o agente lê; esta seção resolve *como* ele se autocorrige. Erro estruturado em compile-time é o que permite ao agente iterar sozinho (escrever → verificar → corrigir) sem você no loop.

### TypeScript strict de verdade

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,   // acesso a array vira T | undefined
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

Erro em compile-time > erro em runtime > erro em produção. Cada nível à esquerda é um erro que o agente corrige sozinho em segundos.

### Fonte única de tipos

Tipos **derivam** de schemas — nunca são declarados duas vezes:

- Validação: `z.infer<typeof schema>` (Zod). Muda o schema, o tipo segue.
- Banco: tipos inferidos do schema do banco (ex.: Drizzle `InferSelectModel` — funciona com D1). Muda a tabela, tudo que usa o tipo quebra na compilação.

É o mesmo argumento dos contratos OpenAPI (seção 4), aplicado dentro do repo: uma fonte da verdade, o resto é gerado/inferido.

### Um comando de verificação

Cada repo expõe **um comando** que roda lint + type-check + testes (ex.: `pnpm check`). O agente roda após cada mudança; o `CLAUDE.md` declara o comando. Tooling rápido importa: feedback em segundos = mais iterações por tarefa.

### Logs estruturados

JSON, nunca string solta. Convenção de evento: `domínio.componente.ação_estado` (`quiz.answer.save_started`, `quiz.answer.save_failed`), com contexto (`requestId`, `userId`). Em Workers, `console.log(JSON.stringify(...))` + Workers Logs resolve; em Go, `slog`. O agente consegue filtrar e rastrear uma operação ponta a ponta.

### Erros em três camadas

1. **`errors.ts` na fatia**: classes próprias (`AnswerNotFoundError`) com status HTTP, código estável e contexto.
2. **Handler central**: converte qualquer erro na resposta padrão.
3. **No fio**: `application/problem+json` (RFC 9457, seção 4).

A classe da feature → handler → problem+json. As três camadas se completam: a primeira dá contexto ao código, a última dá contexto ao consumidor (humano ou agente).

-----

## 4. Práticas de API transversais

Estas valem para **qualquer serviço novo** — Worker TS ou serviço Go. Adoção barata, ganho alto. Agentes de IA consomem nossas APIs do mesmo jeito que o front: o design precisa ser **agent-callable**.

### Erros estruturados (RFC 9457)

Toda API devolve `application/problem+json`, nunca string solta ou HTML:

```json
{
  "type": "estoque-insuficiente",
  "status": 409,
  "detail": "Restam 2 unidades, pedido de 5",
  "instance": "/orders/abc123"
}
```

Front e agente conseguem tratar o erro programaticamente e se recuperar. Códigos de erro **estáveis** (o agente decide a próxima ação pelo `type`, não parseando texto).

### Idempotência

Em mutações sensíveis (pagamento, criação de lead), aceite uma `Idempotency-Key`. Agentes fazem **retry agressivo** em timeout — sem idempotência, transação duplicada. Fácil de implementar com D1/KV.

```ts
// pseudo
const key = req.headers.get("Idempotency-Key");
const existing = await kv.get(key);
if (existing) return existing;       // retorna resultado anterior
const result = await processar();
await kv.put(key, result, { ttl });
return result;
```

### Endpoints reveladores de intenção

Exponha operações de negócio de alto nível em vez de obrigar o cliente a orquestrar CRUD:

- ❌ `POST /cart` + `POST /items` + `POST /pay`
- ✅ `POST /orders/checkout`

Menos passos encadeados = menos chance de o agente errar a sequência.

### Descoberta e proteção para agentes

- **Spec descobrível**: exponha a especificação OpenAPI em `/.well-known/openapi`. Agentes (via MCP) descobrem e invocam rotas como ferramentas, sem precisar de docs externas. Anotações semânticas (`x-agent-hint`) ajudam o agente a escolher o endpoint certo.
- **Rate limiting com `Retry-After` explícito**: agentes geram tráfego em rajadas sequenciais. Sem um `Retry-After` legível por máquina, o agente martela o endpoint; com ele, recua e tenta de novo no momento certo.

### Contratos / type-safety (OpenAPI-first como ponte Go ↔ TS)

Nossa topologia é exatamente a do material de referência: **backend Go + front Next.js**. O contrato OpenAPI vira a fonte única da verdade entre os dois times, eliminando desvio de nomenclatura e boilerplate manual.

- **Lado Go (backend):** `oapi-codegen` gera structs, modelos de request/response com validação embutida e as interfaces do servidor a partir do YAML. O dev de backend foca só em implementar a interface gerada.
- **Lado TS (front):** `openapi-typescript` gera os tipos exatos de cada endpoint a partir do **mesmo** contrato — se o back renomeia um campo, o front quebra na compilação, não em produção.
- **gRPC / Protobuf** para microsserviços Go internos que exigem baixa latência; o gateway de borda traduz as chamadas internas em REST/OpenAPI amigável pro consumo no Next.js.
- **No mundo só-TS** (Worker ↔ front, sem passar pelo Go): Zod compartilhado ou tRPC seguem sendo o caminho mais direto.

Regra do time: **nenhum código de front ou back antes do contrato aprovado.** O arquivo vive em `/api-contracts/<serviço>.yaml` e é a única fonte da verdade.

### Onde os contratos moram e como são consumidos

O `.yaml` é o **único arquivo escrito à mão**. Todo o resto é gerado a partir dele e, por convenção, **não se edita na mão** (regenera do contrato):

```
1. Escreve/edita  contracts/orders.yaml          ← fonte da verdade
2. Abre PR só do contrato → review/aprovação      ← Checkpoint de contrato
3. CI roda os geradores:
   ├─ oapi-codegen        → orders.gen.go   (structs + interface do server)
   └─ openapi-typescript  → orders.d.ts     (tipos exatos pro front)
4. Back implementa a interface gerada; front importa os tipos gerados
```

Se o back renomeia `answerId` → `answer_id` no YAML, o tipo do front é regenerado e **quebra na compilação** — você descobre na hora, não em produção.

**Onde mora (no nosso polyrepo):** como back (Go) e fronts (Next.js) estão em repos separados no `tech-utua`, e não vamos migrar pra monorepo durante o Nexus, a fonte vive num **repo dedicado de contratos**:

```
tech-utua/api-contracts/
├── contracts/                 # os YAMLs — fonte da verdade, escritos à mão
│   ├── orders.yaml
│   ├── leads.yaml
│   └── quiz.yaml
├── gen/                       # gerado pela CI, não editar à mão
│   ├── go/                    # Go module: github.com/tech-utua/api-contracts/gen/go
│   └── ts/                    # npm package: @tech-utua/api-types
├── .github/workflows/
│   └── generate.yml           # roda oapi-codegen + openapi-typescript no PR
└── README.md
```

**Como cada lado consome** (versionado por semver, então mudança de contrato não quebra todo mundo de surpresa):

- **Front (Next.js):** instala o package `@tech-utua/api-types` (publicado via GitHub Packages) e pina a versão.
- **Backend (Go):** importa o module `github.com/tech-utua/api-contracts/gen/go` e pina a versão.

Cada consumidor atualiza quando puxa a versão nova — a quebra é controlada, não surpresa.

**Decisão do time — commitar o gerado vs. gerar no build:** recomendamos **commitar o código gerado** no repo (claramente marcado como "não edite à mão"). Vantagens: o diff dos tipos aparece no PR (review real do impacto da mudança de contrato) e o build não depende do gerador estar disponível.

**Alternativas** (se a topologia mudar): em monorepo, os YAMLs vão pra `/api-contracts` na raiz e ambos importam por path. Se cada serviço Go for claramente dono do seu contrato e tiver poucos consumidores, o YAML pode viver no próprio repo do serviço, que publica o package de tipos.

-----

## 5. Processo: onde o humano entra (SDLC híbrido)

A IA muda o gargalo do processo, não só do código: times com alta adoção geram **+98% de PRs**, mas o tempo de review humano sobe **+91%** (dados da pesquisa interna). O gargalo migra de *escrever* para *revisar*. A resposta não é revisar mais rápido — é concentrar o humano em **3 checkpoints deliberados** e automatizar o resto:

1. **Checkpoint de priorização** — humanos definem o escopo de negócio (Jira). O que construir, não como.
2. **Checkpoint de contrato** — aprovação do YAML OpenAPI antes de qualquer código (seção 4). É o review de maior alavancagem: barato de ler, caro de errar.
3. **Checkpoint de intenção** — review humano dos PRs validando *o que* a mudança faz e *por quê*, não cada linha. O lint, o type-check e os testes (seção 3) já validaram o resto.

Depois do checkpoint 3, a integração é automática (merge queue, seção 6).

-----

## 6. Topologia e fluxo (decisões estratégicas)

Peças mais pesadas. Avaliar quando o volume justificar — **não há pressa**.

### Monorepo

Consolidar back (Go) e front (Next.js) num monorepo (Turborepo/Nx) dá o ganho de **commit atômico trans-stack** que o material descreve: alterar schema, endpoint Go, contrato e tipo do front numa tacada coerente — exatamente a topologia Go+Next que já temos.

**Recomendação:** não mexer nisto durante a transição Be Growth → Nexus. Reavaliar depois que a reestruturação assentar. Dois fatores reforçam a calma:

- **A "taxa de contexto" do polyrepo já está parcialmente mitigada em casa**: o **GitNexus** (19 repos indexados, grupos cross-repo, acesso via MCP) cumpre o papel de *API context engine* — dá ao agente visão cross-repo sem migração de topologia.
- **Cuidado com a estatística**: o benchmark citado na pesquisa (ciclo mediano de PR ~2h em polyrepo vs ~19h em monorepo) mostra o monorepo **mais lento por PR**. A leitura "são mudanças trans-stack de alto impacto" é possível, mas o número não é argumento pró-monorepo sozinho.

### Paralelismo com worktree

Já pode usar **hoje** em features novas/em slice. Cada `git worktree` = um agente trabalhando numa fatia isolada, sem conflito.

### Merge queue (GitHub)

Estamos no GitHub (org `tech-utua`), que tem **merge queue nativo**: testa cada PR já simulando o estado futuro da `main` e ejeta só o que quebra (deixando o relatório de erro no PR para o dev ou agente corrigir), mantendo a branch verde sob alto volume de PRs concorrentes (humanos + agentes). Recursos avançados (batching, quarentena de teste flaky) existem em ferramentas dedicadas (Graphite, Aviator) se o volume justificar.

**Recomendação:** ativar quando o volume de PRs paralelos virar gargalo real. Provavelmente ainda não é o caso.

-----

*Inspirado no CODEBASE-GUIDE de Cole Medin (ai-transformation-workshop), nos vídeos de Matt Pocock sobre codebases AI-ready e na pesquisa interna sobre engenharia nativa em IA, adaptado ao stack da UTUA: Go (backend) · Next.js · TypeScript · Cloudflare · Strapi · GCP · GitHub (org tech-utua).*
