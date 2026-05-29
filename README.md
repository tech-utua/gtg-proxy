# gtg-proxy

Cloudflare Worker que implementa o **Google Tag Gateway for Advertisers** manualmente, como proxy reverso first-party para domínios servidos via Cloudflare. Substitui a integração native Cloudflare↔GTG sem depender de Origin Rules (recurso restrito ao plano Enterprise).

## Contexto e justificativa

A UTUA migrou em maio de 2026 para um setup manual do Google Tag Gateway nos seus principais domínios de receita. A motivação foi prática: a integração native entre Cloudflare e GTG apresentou instabilidade num domínio crítico — eventos pararam de chegar ao container sem alerta visível e o rollback exigiu intervenção manual na UI. Considerando o volume de investimento na conta de Google Ads e a sensibilidade da medição, optamos por replicar o comportamento do GTG num Worker da Cloudflare sob nosso controle.

A documentação oficial do Google indica o uso de Origin Rules para a implementação manual, recurso disponível apenas no plano Enterprise. O Worker entrega o mesmo resultado em qualquer plano, com a vantagem adicional de ser inspecionável, versionável e observável do nosso lado.

O measurement path adotado é `/_ev`, idêntico ao default da implementação native. Todo o roteamento ocorre dentro desse prefixo — qualquer request fora dele segue sendo servida normalmente pelas rotas de aplicação dos sites.

## Arquitetura

Há um único Worker (`gtg-proxy`) deployado em uma conta Cloudflare, responsável por todos os domínios cobertos. As rotas dele são `<domínio>/_ev/*`. A lógica é direta: recebe a request, identifica qual tag é dona dela, encaminha para o upstream `*.fps.goog` correspondente e devolve a resposta ao cliente.

A identificação da tag segue três níveis de prioridade. Quando a request traz `?id=XXX`, esse ID é o vencedor — caso típico de bootstrap (carregamento do gtm.js ou gtag/js). Se não houver `id` mas houver `?tid=XXX`, esse é usado — caso típico dos hits de medição como `/g/collect`. Sem nenhum dos dois, o Worker cai num default por hostname, que cobre endpoints como `/_ev/healthy` que não trazem identificador na query.

Antes de proxar para o upstream, o Worker faz quatro ajustes que preservam o comportamento esperado pelo Google:

- O `Host` header é reescrito para o upstream `*.fps.goog`, mantendo `pathname + search` originais intactos. O measurement path chega ao Google tal qual foi configurado.
- Os headers `X-Forwarded-Country`, `X-Forwarded-Region` e `X-Forwarded-CountryRegion` são populados a partir do `request.cf` (geolocalização da edge Cloudflare). O Google usa esses dados para classificação de origem.
- `Origin` e `Referer` são normalizados para o domínio do site, evitando que cabeçalhos contaminados de iframes ou navegação cruzada quebrem a atribuição.
- Headers internos da Cloudflare (`cf-connecting-ip`, `cf-ray`, `cf-visitor` etc.) são removidos antes do encaminhamento.

Na resposta de volta, o atributo `Domain=` é removido de qualquer `Set-Cookie`. Os cookies (`_ga`, `_gid`, `_gcl_au`, `_gcl_aw`) gravam como host-only no domínio do site, e não em `.fps.goog` — esse é o ponto que sustenta a propriedade "first-party" do GTG.

## Mapeamento atual (UTUA, 2026-05-29)

| Domínio   | Container default | GA4 child       | Outras tags    | Conta(s) Google                  |
|-----------|-------------------|-----------------|----------------|----------------------------------|
| utua.lv   | GTM-KLGPQCKL      | G-DCFVCWRHN9    | AW-659095278   | UTUA + Be Growth Hub (Ads)       |
| utua.de   | GTM-MFK4MDQ9      | G-SFM5F23YPQ    | —              | UTUA                              |

A convenção de upstream é o ID em minúsculas com hífens preservados, sufixado por `.fps.goog`. Por exemplo, `GTM-KLGPQCKL` mapeia para `gtm-klgpqckl.fps.goog`. Todas as tags acima estão com cadastro GTG concluído nos respectivos painéis (GTM Admin para containers, GA4 Admin → Data Streams para tags G-\*, Google Ads para AW-\*), com measurement path `/_ev`.

## Validação operacional

Três checagens cobrem a maioria dos cenários para confirmar que a implementação está saudável num domínio:

1. `https://<domínio>/_ev/healthy` retorna `ok` em texto plano.
2. Em aba anônima, sem ad blocker, abrir o site e filtrar o DevTools Network por `_ev/`. A primeira request é `/_ev/?id=<container>`, com status 200 e tamanho entre 80KB e 500KB (variável conforme a configuração do container). As medições subsequentes aparecem como `/_ev/ga/g/c?tid=<G-...>` ou `/_ev/r/collect?tid=<G-...>`. Um filtro complementar por `googletagmanager.com` deve voltar vazio (exceto pelo iframe do noscript fallback).
3. No DevTools Application → Cookies, os cookies do GA/Ads aparecem com o domínio do site (e não `.fps.goog`).

Como validação cruzada, o GA4 Realtime e os relatórios de conversão do Google Ads seguem sendo a fonte de verdade — a primeira conversão real costuma aparecer entre alguns minutos (Realtime) e 24h (Ads).

O Preview Mode do GTM (via `tagassistant.google.com`) e o Tag Assistant também funcionam normalmente neste setup — os eventos saem pelo `/_ev/` e aparecem no debugger, com inspeção do container e passo a passo do dataLayer disponíveis para QA de tags novas sem necessidade de desativar o gateway.

## Limitações conhecidas

A Cloudflare oferece um toggle de "Google Tag Gateway" native na UI da zona. Em todos os domínios em que rodamos o Worker, esse toggle deve permanecer Inactive. Mantê-lo ativo simultaneamente gera conflito de injeção e quebra ambos os mecanismos.

## Como deployar

1. Clone o repo e instale dependências:
   ```bash
   git clone https://github.com/tech-utua/gtg-proxy.git
   cd gtg-proxy
   npm install
   ```
2. Edite `wrangler.toml` adicionando o `account_id` da sua conta Cloudflare e os `routes` para cada domínio que vai cobrir.
3. Edite `src/index.js`:
   - Adicione cada tag ID no `TAG_UPSTREAMS` (formato `"GTM-XXX": "gtm-xxx.fps.goog"`).
   - Adicione cada domínio em `DEFAULT_TAG_FOR_HOST` apontando para o container raiz.
4. Deploy:
   ```bash
   npx wrangler deploy
   ```

## Expansão (novo domínio ou nova tag)

Para adicionar um novo domínio ou uma nova tag, o procedimento é:

1. Adicionar o mapeamento `tag ID → upstream` em `TAG_UPSTREAMS` (tags novas) e, no caso de domínio novo, uma entrada em `DEFAULT_TAG_FOR_HOST`.
2. Criar a Worker Route `<domínio>/_ev/*` no `wrangler.toml` apontando para `gtg-proxy` na zona Cloudflare correspondente.
3. Atualizar o snippet de instalação do GTM no site para carregar de `/_ev/?id=<container>` em vez de `googletagmanager.com/gtm.js`.
4. Cadastrar o GTG no painel Google de cada tag ID (container raiz, cada GA4 child, cada tag de Ads), com domain e measurement path correspondentes. Esse passo é feito conta a conta — não há herança automática entre tag pai e filha.

A validação operacional descrita acima é o critério de aceite.

## Licença

[MIT](LICENSE)
