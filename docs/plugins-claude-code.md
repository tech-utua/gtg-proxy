---
title: "Plugins do Claude Code da UTUA"
product: processo
type: setup
owner: "@Thiago Enge"
status: stable
updated: 2026-08-28
publish: true
summary: "Como instalar as skills e agents do time no seu Claude Code, e o que cada pacote traz."
audience: "Engenharia"
nav_title: "Plugins do Claude Code"
nav_order: 2
---

<!-- gerado por utua-docs · réplica read-only · não edite aqui -->

# Plugins do Claude Code da UTUA

> As skills e os agents que o time construiu deixaram de viver só na máquina de
> quem os escreveu. Agora são dois plugins instaláveis, com um comando.

## Instalação

```
/plugin marketplace add tech-utua/utua-workspace
/plugin install utua-tech@utua-tech
```

Se você mexe com anúncios, instale também:

```
/plugin install utua-adtech@utua-tech
```

Se a instalação disser `Run /reload-plugins to activate`, rode esse comando.

**Você não precisa clonar o `utua-workspace`.** O Claude Code faz o próprio clone,
numa área separada do seu diretório de trabalho.

:::atencao Pré-requisitos
O repositório é privado, então você precisa de **acesso a `tech-utua` no GitHub**
e da sua **chave SSH carregada no `ssh-agent`** — o atalho `owner/repo` clona por
SSH, e o Claude Code não abre prompt interativo para senha de chave ou
confirmação de fingerprint.

Se você usa HTTPS em vez de SSH, exporte `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` e
configure um credential helper (`gh auth setup-git`).
:::

## O que cada plugin carrega

### `utua-tech` — engenharia (~743 tokens por sessão)

| Componente | O que faz | Custo ao usar |
|---|---|---|
| `ai-ready-check` | Diagnostica a aderência do repositório ao [Guia de Codebase AI-Ready](./ai-ready-codebase.md): quadro por seção com evidência `arquivo:linha`, os 3 passos mais baratos e um plano incremental. Não altera código | ~2,2k |
| `conversion-analytics-guide` | Copiloto de integração do `conversion-analytics-sdk`: catálogo oficial de eventos, API, padrões de integração e contrato do collector | ~2,9k |
| `triage` | Triagem em lote de tickets do Jira: busca as issues de um board, apresenta em pares por prioridade, aplica decisões em batch e comenta com contexto de commits e PRs | ~2,3k |
| `release` | Fluxo pós-merge completo: cria a tag semver, atualiza o Jira e anuncia no Slack | ~900 |
| `handoff` | Gera o resumo do estado atual mais um prompt pronto para continuar em outra sessão | ~1,1k |
| **`code-review-agent`** | Revisa **só o que mudou**, nunca a base inteira, em cinco frentes: código morto, inconsistências, style comparado ao repo, bugs lógicos e segurança. Registra os padrões no `lessons.md` do projeto | ~3,9k |
| **`scrum-master-agent`** | Gestão ágil com Jira, Confluence e Slack: cria issues e épicos, move entre sprints, monta boards e processa demanda que chega em planilha. Nunca deleta nada nem troca assignee sem aprovação | ~5,1k |

### `utua-adtech` — monetização (~881 tokens por sessão)

| Componente | O que faz | Custo ao usar |
|---|---|---|
| `gpt-adtech` | Engenheiro de Google Publisher Tag e mídia programática: implementação de slots, debug de viewability, latência e CLS, consent e TCF, header bidding com Prebid e Amazon | ~3,7k |
| `ad-inserter-pro-expert` | Especialista no Ad Inserter Pro do WordPress: configura e audita blocos, posições de inserção, `url_list`, targeting por device e scheduling | ~3k |

**Instale só o que você usa.** As duas skills de ad-tech custam mais que o pacote
de engenharia inteiro — por isso estão separadas. Quem não mexe com anúncios não
deveria pagar esse contexto em toda sessão.

## Como usar

As skills ficam disponíveis com o nome do plugin na frente:

```
/utua-tech:ai-ready-check
/utua-adtech:gpt-adtech
```

Você não precisa invocar à mão: o Claude também aciona sozinho quando a
conversa bate com a descrição da skill. O `@`-mention dos agents segue o mesmo
padrão (`@utua-tech:code-review-agent`).

## Exemplos de uso

Casos reais do dia a dia. Você não precisa decorar comando: em quase todos, basta
descrever a situação e o Claude aciona a skill certa sozinho.

### Revisar antes de abrir o PR

```
revisa o que eu mudei nessa branch antes de eu abrir o PR
```

O `code-review-agent` olha **só o diff**, nunca a base inteira, em cinco frentes:
código morto, inconsistências, style comparado ao resto do repositório, bugs
lógicos e segurança. Devolve os achados por severidade e registra os padrões no
`lessons.md` do projeto — então a revisão de hoje deixa o repositório mais
inteligente amanhã.

### Limpar um board que acumulou

```
/utua-tech:triage
```

Busca as issues em *To Do* e *In Review*, apresenta em pares por prioridade, você
decide, e ela aplica em batch com comentário de contexto (commits, PRs). Uma
sessão manual de meia hora no Jira vira cerca de cinco minutos.

### Fechar o ciclo depois do merge

```
o PR #45 foi mergeado, roda o release
```

Cria a tag semver, atualiza o Jira para Done e anuncia no Slack — **sem parar
para pedir confirmação entre as etapas**. É o fluxo que costuma ficar pela
metade quando é feito à mão.

### Descobrir o quanto um repositório está AI-Ready

```
/utua-tech:ai-ready-check
```

Roda dentro do repositório e devolve o quadro de aderência por seção com
evidência `arquivo:linha`, os três passos mais baratos e um plano incremental.
Não altera nada — só diagnostica.

É o mesmo diagnóstico que antes exigia salvar o guia dentro do repositório e
colar um prompt de vinte linhas à mão.

### Parar no meio e retomar depois

```
/utua-tech:handoff
```

Gera o resumo do estado atual mais um prompt pronto para colar na próxima
sessão. Útil no fim do dia, antes de trocar de contexto, ou quando a janela está
ficando pesada.

### Instrumentar um evento sem inventar nome

```
preciso disparar o evento de quiz completo com as properties certas
```

O `conversion-analytics-guide` responde a partir do catálogo oficial de eventos e
da API do SDK — nome exato, properties obrigatórias, contrato do collector. Ele é
instruído a **nunca inventar** evento, property ou método.

### Transformar demanda de área de negócio em issue

```
chegou essa planilha de demandas do time de aquisição, transforma em issues
```

O `scrum-master-agent` lê a planilha, escreve as histórias com critério de aceite
e cria no board certo. Ele pode criar issue, épico e sprint, e mover tarefa entre
sprints. **Nunca** deleta, arquiva, troca assignee ou fecha sprint antes do prazo
sem aprovação explícita.

### Anúncio que não renderiza

```
o mob_top não está renderizando no utua.africa, me ajuda a debugar
```

O `gpt-adtech` ataca por hipótese ranqueada: definição do slot, ordem do
`cmd.push`, consent e CMP, lazy load, viewability. É a skill para qualquer coisa
de GPT/GAM, header bidding ou CLS causado por anúncio.

### Auditar um bloco do Ad Inserter

```
audita o bloco 4 do utua.jobs e me diz se a url_list está correta
```

O `ad-inserter-pro-expert` conhece as opções do plugin a fundo — posição de
inserção, targeting por device, scheduling e, principalmente, a pegadinha de
`url_list_type` vazio significar **denylist**, que já causou bloco rodando onde
não devia.

:::atencao As duas últimas exigem o `utua-adtech`
Elas não vêm no `utua-tech`. Instale `utua-adtech@utua-tech` se o seu trabalho
encosta em anúncio.
:::

## Atualizar e remover

```
/plugin marketplace update utua-tech    # puxa o catálogo
/plugin update utua-tech                # atualiza o pacote
/plugin uninstall utua-tech             # remove
```

Os plugins **não têm número de versão fixo**: a versão é o commit da `main` do
`utua-workspace`. Na prática, todo merge chega para quem atualizar — ninguém
precisa lembrar de incrementar nada.

## Cursor, Codex e Copilot

:::atencao Se você usa Cursor, Codex ou Copilot
Plugin é um mecanismo do Claude Code — não alcança nenhuma dessas ferramentas.
O que vale para elas é `AGENTS.md` e `.cursor/rules/` **na raiz de cada
repositório**, e hoje **nenhum dos 13 repositórios do time tem `AGENTS.md`**.

Se o seu fluxo é Cursor ou Codex, o caminho não é este documento: é abrir um PR
adicionando `AGENTS.md` no repositório em que você trabalha.
:::

## Contribuir com uma skill

A fonte continua em `.claude/skills/` do `utua-workspace` — os plugins são
symlinks para lá, não cópias. Para incluir uma skill nova no pacote:

1. escreva a skill em `.claude/skills/<nome>/SKILL.md`
2. crie o symlink: `ln -s ../../../.claude/skills/<nome> plugins/utua-tech/skills/<nome>`
3. abra PR

A inclusão é **explícita de propósito**. Nenhuma skill entra num plugin só por
estar na pasta — foi assim que garantimos que material de gestão não vaza para
um pacote distribuído.

## Quando algo dá errado

| Sintoma | Causa provável |
|---|---|
| `Marketplace not found` ao instalar | O marketplace não foi adicionado. Rode o `marketplace add` antes |
| Erro de repositório não encontrado | Você não tem acesso a `tech-utua`, ou sua chave SSH não está no `ssh-agent` |
| Skill não aparece depois de instalar | Rode `/reload-plugins`, ou reinicie a sessão |
| Atualização automática falha de vez em quando | Conhecido em marketplace privado por HTTPS: o refresh de fundo não usa credential helper. Use SSH, ou rode `/plugin marketplace update` à mão |
| Agent do plugin não aparece | Confirme com `claude plugin details utua-tech`. Se o inventário mostrar `Agents (0)`, é bug do pacote — abra issue |

:::atencao Testando um plugin antes de publicar
Rode `claude --plugin-dir <caminho>` com o diretório de trabalho **fora** do
repositório que define o plugin. Com o cwd dentro dele, skills e agents do
projeto aparecem como se viessem do plugin, e o teste passa mesmo com o pacote
quebrado. Foi exatamente assim que um bug de agents chegou a ser publicado aqui.
:::

## Referências

- Repositório e marketplace: `tech-utua/utua-workspace`
- [Guia de Codebase AI-Ready](./ai-ready-codebase.md)
