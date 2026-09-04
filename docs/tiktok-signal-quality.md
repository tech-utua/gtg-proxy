---
title: TikTok — replicar a qualidade de sinal para outros países
nav_title: TikTok — qualidade de sinal
nav_order: 1
product: tracking
type: runbook
audience: Operação
summary: A auditoria do TikTok apontou quatro indicadores em 0% porque a conversão não passava por tag nossa. Esta página ensina o que o piloto das Filipinas fez para resolver e como repetir isso em outro país.
owner: tech-utua
status: stable
updated: 2026-09-02
publish: true
---

<!-- gerado por utua-docs · réplica read-only · não edite aqui -->

# TikTok — replicar a qualidade de sinal para outros países

> Como levar aos demais países o que o piloto das Filipinas já entregou: conversão saindo do
> GTM com e-mail, valor e moeda, mais uma cópia server-side. Siga na ordem — o passo 5 é o que
> evita contar conversão dobrada.

## Por que isso existe

A gerente de contas do TikTok auditou cinco contas da Nexus e apontou quatro indicadores em
**0%**: cobertura de PII, validade de PII, cobertura de value/currency e validade de
value/currency. Sem eles o algoritmo otimiza por "quem chegou na página", não por perfil de lead
qualificado — e não existe ROAS mensurável.

A causa é uma só, e é estrutural:

:::atencao A conversão não passava por tag nossa
Ela era uma **regra do Events Builder**, criada no painel do TikTok: *"URL contém `lead=true`
→ `Purchase`"*. Esse mecanismo dispara o evento e nada mais — não tem como anexar e-mail, valor
ou moeda, porque não conhece nada da página além do endereço. Por isso os quatro indicadores
davam exatamente zero, e não "quase zero".
:::

A saída é mover a conversão da regra do painel para uma **tag no GTM**, que roda dentro da
página e enxerga o e-mail que o quiz gravou. É essa troca que esta página descreve.

## O modelo que o piloto entregou

São três eventos de conversão, cada um saindo por **duas vias** — pixel e Events API — mais o
`Pageview` do código-base:

| Evento | Quando dispara | Vias |
|---|---|---|
| `Pageview` | toda página da campanha | código-base (identidade vem da tag de identify) |
| `ViewContent` | **toda `p1`**, com ou sem `lead=true` | pixel + Events API |
| `CompleteRegistration` | no envio do lead (`lead=true`) | pixel + Events API |
| `Purchase` | no envio do lead (`lead=true`) | pixel + Events API |

Do lado do pixel é uma tag por evento; do lado da Events API é **uma tag só**, que lê a URL e
manda os eventos daquela pageview.

Cada par pixel + Events API **não** vira duas conversões: os dois carregam o mesmo `event_id`, e o
TikTok deduplica pela combinação `(evento, event_id)` — vale o primeiro que chegar
([doc](https://ads.tiktok.com/help/article/event-deduplication?lang=en)). É essa redundância que
atende ao quinto item da auditoria: se o navegador falhar, bloquear anúncio ou perder a rede, a via
server-side entrega.

:::atencao Os três eventos da mesma pageview compartilham um `event_id`
Isso é correto, e é o que a variável `TT - Event ID` garante ao guardar o valor em `window`. Como a
chave de deduplicação é a **combinação** `(evento, event_id)`, `ViewContent` e `Purchase` com o
mesmo ID não colidem — são chaves diferentes. O que precisa casar é o par **entre as duas vias**
do mesmo evento, e um ID por tag quebraria justamente isso.
:::

:::perigo O nome do evento tem de bater exatamente entre as duas vias
Se a tag de pixel manda `CompleteRegistration` e a da Events API manda `Complete Registration` ou
`CompleteRegistrations`, o par **não casa** e a mesma conversão conta **duas vezes**. Um erro de
digitação aqui não gera erro visível — gera número inflado.
:::

:::atencao O `ViewContent` da landing sai sem e-mail
Quem acabou de cair na página ainda não deu o e-mail, então `User Email SHA256` vem vazia e o
evento vai sem PII. É o comportamento correto — melhor campo ausente que valor lixo.

Efeito colateral a não confundir com regressão: entrou no funil um evento de alto volume e sem PII.
Se o painel agregar cobertura de PII entre eventos, **o número pode cair** sem nada ter quebrado.
Leia a cobertura **por evento** antes de concluir que regrediu.
:::

:::atencao `CompleteRegistration` e `Purchase` disparam na mesma condição
Os dois saem do mesmo gatilho (`lead=true`), então têm volume idêntico: descrevem o mesmo ato com
nomes diferentes. Isso é deliberado — dá ao algoritmo um evento alternativo para otimizar —, mas
significa que **otimizar pelos dois ao mesmo tempo é otimizar duas vezes pelo mesmo sinal**.
Escolha um por campanha.
:::

**Nenhuma regra sobrou no Events Builder do pixel.** É intencional, e o passo 5 explica: os três
eventos vêm de tags do GTM, e regra no painel voltaria a duplicar.

## Antes de começar

Confirme três coisas para o país que vai replicar. Todas já causaram retrabalho:

1. **Qual superfície recebe o tráfego pago da conta** — e, portanto, qual container do GTM. Não
   deduza pelo nome da conta: `[NX]uk.cc.utua.uk` e `[NX]jp.cc.utua.com` rodam em containers
   diferentes dos demais, e esses containers não têm nada montado.
2. **Qual o alcance real da regra do Events Builder** que você vai substituir. Abra a regra e
   leia a condição inteira antes de escrever o gatilho da tag.
3. **Se o país já tem tag do TikTok no container.** Vários já têm — e nesses casos o trabalho é
   *corrigir* a tag existente, não criar outra.

O passo 4 depende do **time de dev** (acesso à Cloudflare). Abra o pedido cedo para não esperar
por ele no fim — os demais passos seguem em paralelo.

## Passo a passo

### 1. Adicione o país às três Lookup Tables

As variáveis são tabelas indexadas pelo código do país, então na maioria dos casos **não se cria
tag nova** — acrescenta-se uma linha em cada uma:

| Variável | Exemplo (Filipinas) |
|---|---|
| `TT - Pixel Code Map` | `ph` → `D8K2JMBC77UDG683OTH0` |
| `TT - Lead Value` | `ph` → `0.8` |
| `TT - Lead Currency` | `ph` → `BRL` |

É esse desenho que faz uma tag servir todos os países. Se você se pegar clonando tags por país,
provavelmente falta uma linha numa tabela.

:::atencao A moeda é BRL de propósito, mesmo em conta de outro país
Decisão do time: rodar tudo em `BRL` para os números ficarem comparáveis entre países. O TikTok
converte para a moeda da conta ao reportar. A variável existe justamente para permitir mudar
isso depois sem mexer em tag.
:::

### 2. Crie os dois gatilhos do país

:::perigo O gatilho tem que cobrir o mesmo alcance da regra que você vai remover
No piloto o gatilho nasceu exigindo a vertical (`/ph-emp-`), enquanto a regra removida casava só
`lead=true`, **sem prefixo de vertical**. Resultado: 105 páginas `/ph-cc-*` ficaram sem
`Purchase` por seis dias, sem erro nenhum aparecer.

O gatilho correto do piloto ficou `Page Path` **contém** `/ph-`. Confira o alcance da regra
antiga antes de escrever o seu.
:::

São **dois** gatilhos, nenhum deles com exceção:

| Gatilho | Condições | Quem usa |
|---|---|---|
| **lead** | `/<país>-` + `-p1` + `lead=true` + `utm_source=tiktok` | `Identify`, `CompleteRegistration`, `Purchase` |
| **p1** | `/<país>-` + `-p1` + `utm_source=tiktok` | `ViewContent` (pixel), `Events API` |

O gatilho **p1** não filtra `lead=true`, então casa a landing **e** a página de conversão. É o que
faz o `ViewContent` marcar as duas — e é por isso que a tag da Events API também manda `ViewContent`
nas duas: as duas vias precisam enviar o mesmo conjunto, senão o evento fica sem par server-side.

:::atencao O **p1** tem de ser o **lead** menos a condição `lead=true` — nada além disso
Escreva os dois com exatamente os mesmos filtros de path, mudando só a presença do `lead=true`.
Assim o **p1** é, por construção, superconjunto do **lead**.

Se os filtros divergirem — um usando `-p1` e o outro `p1/`, por exemplo — abre-se a borda em que a
página de conversão casa o **lead** mas não o **p1**. O `ViewContent` sumiria exatamente onde a
conversão acontece, e o `Purchase` do server-side junto, já que os dois dependem do **p1**.
:::

### 3. Clone as cinco tags do piloto

| Tag | Gatilho | O que é |
|---|---|---|
| `Identify` | lead | anexa a identidade ao pixel |
| `ViewContent` (pixel) | **p1** | evento de topo, com `content_id` |
| `CompleteRegistration` (pixel) | lead | evento de meio |
| `Purchase` (pixel) | lead | conversão |
| `Events API` | **p1** | cópia server-side dos **três** eventos |

O código de cada uma está mais abaixo. Três tags do lado do pixel porque o template oficial manda
um evento por tag; uma só do lado da Events API, que é código nosso e decide sozinha.

:::atencao O `content_id` do `ViewContent` no template do pixel
Ele não aparece por padrão. Em *Manually Input Single / Multiple Products*, escolha
**Single Content** — aí os campos abaixo ficam disponíveis:

| Campo | Valor |
|---|---|
| Content ID | `{{TT - Content ID}}` |
| Content Type | `product` |

O TikTok **exige `content_type` junto com `content_id`**, e só aceita `product` ou
`product_group` ([doc](https://ads.tiktok.com/help/article/about-parameters?lang=en)). A landing é
um item único, então `product`. Os dois campos precisam existir também na tag da Events API — se
uma via mandar e a outra não, as propriedades divergem entre browser e servidor.
:::

### 4. Peça ao time de dev para cadastrar o token no Worker

:::atencao Este passo não é da operação
Ele exige acesso ao painel da Cloudflare, que a operação não tem. **Abra um pedido para o time
de dev** — é uma tarefa de poucos minutos do lado deles.

**O que a operação faz:** gera o access token no Events Manager do TikTok (isso sim é no painel
que vocês acessam) e informa ao dev **qual pixel** e **de qual conta** ele pertence.
:::

A via server-side usa um Worker que guarda os tokens. Ele tem **um único segredo**,
`TIKTOK_TOKENS`, que é um JSON de pixel para token:

```json
{
  "D8K2JMBC77UDG683OTH0": "<access token da conta das Filipinas>",
  "<pixel do novo país>": "<access token da conta dele>"
}
```

Replicar um país é **acrescentar uma chave nesse JSON** — sem deploy de código. Cada conta de
anúncio tem seu próprio par pixel/token, e o Worker escolhe o token pelo pixel que chega na
requisição.

:::perigo O access token não vai por Slack, e-mail nem planilha
É uma credencial: quem a tiver consegue mandar eventos como se fosse a conta. Combine com o dev
um canal seguro para entregá-la — gerenciador de senhas, por exemplo. E ela nunca toca o
navegador: é justamente por isso que a chamada passa pelo Worker em vez de ir do navegador
direto ao TikTok.
:::

:::atencao Este passo não bloqueia os outros
Enquanto o token não estiver cadastrado, as tags de `Identify` e `Purchase` funcionam normal e
os quatro indicadores da auditoria já sobem — só a **redundância** da Events API fica pendente.
A tag da Events API pode ficar publicada: ela ignora a falha da chamada em silêncio, sem afetar
o evento que o pixel manda. Siga para o passo 5 sem esperar.
:::

### 5. Remova as regras do Events Builder desse pixel

:::perigo Este passo é o que evita contar conversão dobrada
Enquanto a regra do Events Builder existir **e** a tag do GTM disparar, cada lead vira dois
`Purchase` — e eles **não** deduplicam entre si, porque o Events Builder não emite `event_id`. O
número da conta infla e as campanhas passam a otimizar em cima de um valor falso.

Rollback, se algo der errado: pause a tag do GTM e reative a regra.
:::

No piloto saíram as três regras, não só a do `Purchase`. As outras duas eram ruído: o
`ViewContent` repetia o `Pageview` que o código-base já dispara na mesma exibição, e o
`CompleteRegistration` disparava na mesma condição do `Purchase`. Antes de remover, confirme que
nenhuma campanha do país otimiza por esses eventos.

### 6. Valide antes de considerar pronto

Não pule: é o passo que distingue "a tag dispara" de "a conversão chega certa".

## O código das variáveis e tags

:::atencao Isto é um retrato, não a fonte de verdade
A fonte de verdade é o **próprio Tag Manager**. Não existe sincronia entre o GTM e esta página:
se alguém ajustar algo direto no painel, o código aqui fica velho e ninguém é avisado. Use como
ponto de partida ao criar do zero e, na dúvida sobre o que está rodando hoje, **leia o
container, não esta página**.

Retrato de **20/08/2026**, container `GTM-T48CH8D`, versão 662.
:::

### `User Email SHA256` (Custom JavaScript)

Lê o e-mail que o quiz gravou no navegador, normaliza, valida e devolve o SHA-256. É a variável
que fecha os itens 1 e 2 da auditoria.

Duas decisões que parecem detalhe e não são:

- **Nós hasheamos, e entregamos pelo campo `sha256_email`.** O SDK do TikTok também hashearia se
  recebesse o e-mail em claro, mas o pedido da auditoria é explícito quanto ao SHA-256 — então
  cumprimos a letra. ⚠️ `email` = valor cru (o SDK hasheia); `sha256_email` = **já hasheado**.
  Trocar os dois de lugar gera hash duplo e zera o match.
- **Devolve vazio quando o dado é inválido**, em vez de mandar qualquer coisa. Campo vazio não
  derruba a métrica de *validade*; valor lixo derruba. Foi exatamente esse o bug original: nove
  tags mandam, no campo `sha256_email`, um cookie que **não** é o SHA-256 do e-mail — e é por
  isso que a validade de PII dava 0%.

Crie a variável em **Variables › User-Defined › New › Custom JavaScript**, com o nome exato
`User Email SHA256`, e cole o bloco inteiro. O SHA-256 é implementado à mão porque uma Custom
JavaScript Variable precisa responder de forma **síncrona**, e a API nativa do navegador
(`crypto.subtle`) é assíncrona.

```js
function () {
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) {
        out.push(c);
      } else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c < 0xd800 || c >= 0xe000) {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      } else {
        i++;
        c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        out.push(
          0xf0 | (c >> 18),
          0x80 | ((c >> 12) & 0x3f),
          0x80 | ((c >> 6) & 0x3f),
          0x80 | (c & 0x3f)
        );
      }
    }
    return out;
  }

  function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  function sha256Hex(input) {
    var bytes = utf8Bytes(input);
    var bitLen = bytes.length * 8;

    bytes = bytes.slice();
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);

    var hi = Math.floor(bitLen / 4294967296);
    var lo = bitLen >>> 0;
    bytes.push(
      (hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
      (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff
    );

    var H = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    var w = new Array(64);

    for (var offset = 0; offset < bytes.length; offset += 64) {
      var t;
      for (t = 0; t < 16; t++) {
        w[t] =
          (bytes[offset + t * 4] << 24) |
          (bytes[offset + t * 4 + 1] << 16) |
          (bytes[offset + t * 4 + 2] << 8) |
          bytes[offset + t * 4 + 3];
      }
      for (t = 16; t < 64; t++) {
        var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }

      var a = H[0], b = H[1], c = H[2], d = H[3];
      var e = H[4], f = H[5], g = H[6], h = H[7];

      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K[t] + w[t]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;

        h = g; g = f; f = e;
        e = (d + temp1) | 0;
        d = c; c = b; b = a;
        a = (temp1 + temp2) | 0;
      }

      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0;
      H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0;
      H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }

    var hex = '';
    for (var i = 0; i < 8; i++) {
      for (var shift = 3; shift >= 0; shift--) {
        var byte = (H[i] >>> (shift * 8)) & 0xff;
        hex += (byte < 16 ? '0' : '') + byte.toString(16);
      }
    }
    return hex;
  }

  try {
    var raw = localStorage.getItem('__user_traits');
    if (!raw) return undefined;

    var traits = JSON.parse(raw);
    if (!traits || typeof traits !== 'object') return undefined;

    var email = traits.email;
    if (typeof email !== 'string') return undefined;

    email = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return undefined;

    var hash = sha256Hex(email);
    return /^[a-f0-9]{64}$/.test(hash) ? hash : undefined;
  } catch (e) {
    return undefined;
  }
}
```

Copie o bloco inteiro — uma seleção parcial gera hash errado silenciosamente. E não altere a
normalização (`trim` e minúsculas): é ela que faz o hash bater com o que o TikTok calcula do
lado dele.

### `TT - Country Prefix` (Custom JavaScript)

Extrai o código do país do endereço da página. É a chave de entrada das três Lookup Tables.

```js
function () {
  try {
    var m = /^\/([a-z]{2,3})-(emp|cc)-/.exec(location.pathname);
    return m ? m[1] : undefined;
  } catch (e) {
    return undefined;
  }
}
```

:::perigo A lista de verticais é fechada — vertical fora dela não dispara
O padrão reconhecido é `/<país>-<vertical>-<oferta>-p1/`, e a vertical só casa se for `emp` ou
`cc`. Qualquer outra devolve vazio, a tabela não resolve e **a tag não dispara** — sem erro
nenhum, exatamente como aconteceu com as `/ph-cc-*`.

Isso é intencional: define o **escopo** do que este fluxo mede. As Filipinas, por exemplo, têm
três páginas `/ph-finance-*` no ar que ficam de fora por decisão — elas não entram neste fluxo.

O risco é a lista virar escopo por acidente em vez de por escolha. Ao replicar, **liste as
verticais do país** e decida quais entram, em vez de assumir que `emp|cc` cobre tudo. Para
incluir uma vertical, acrescente-a à alternância `(emp|cc)` do código acima — e só então ela
pode receber mídia paga com a conversão sendo registrada.
:::

:::atencao Domínios de país único ficam de fora até alguém agir
Em `utua.com.br` o endereço traz o país (`/ph-emp-...`). Em domínios de país único, como
`utua.fr`, ele começa direto na vertical (`/cc-carte-...`): a variável devolve vazio, a tabela
não resolve e **a tag não dispara**. É falha segura, e melhor que atribuir à conta errada — mas
não é cobertura. Nesses domínios o país existe numa variável global do Ad Inserter
(`window.country`); habilitar isso é decisão de quem opera, e exige confirmar antes que o valor
bate com o país da conta de anúncios.
:::

### `TT - Event ID` (Custom JavaScript)

Gera um identificador por exibição de página e o reaproveita nessa mesma exibição. É ele que faz
o pixel e a Events API contarem **uma** conversão em vez de duas.

```js
function () {
  try {
    if (!window.__ttEventId) {
      window.__ttEventId =
        'tt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
    }
    return window.__ttEventId;
  } catch (e) {
    return undefined;
  }
}
```

:::perigo As duas tags têm que usar esta mesma variável
Se cada uma gerar o seu identificador, os eventos nunca casam e o TikTok conta em dobro. É o
primeiro lugar a olhar se o volume dobrar depois de ligar a Events API.
:::

### `TT - TTCLID` (Custom JavaScript)

Identificador de clique do anúncio, lido do endereço ou do cookie. Vai **em claro, nunca
hasheado** — é dado de atribuição, não de identidade.

```js
function () {
  try {
    var m = /[?&]ttclid=([^&#]+)/.exec(location.search);
    if (m && m[1]) return decodeURIComponent(m[1]);

    var c = /(?:^|;\s*)ttclid=([^;]+)/.exec(document.cookie);
    if (c && c[1]) return decodeURIComponent(c[1]);

    return undefined;
  } catch (e) {
    return undefined;
  }
}
```

### `TT - Content ID` (Custom JavaScript)

Devolve o slug da página, que é o identificador do conteúdo:
`/ph-emp-bdo-personal-loan-p1/` → `ph-emp-bdo-personal-loan-p1`.

```js
function () {
  try {
    var parts = location.pathname.split('/');
    var slug = '';
    for (var i = parts.length - 1; i >= 0; i--) {
      if (parts[i]) {
        slug = parts[i].toLowerCase();
        break;
      }
    }
    return /^[a-z0-9-]{3,120}$/.test(slug) ? slug : undefined;
  } catch (e) {
    return undefined;
  }
}
```

Pega o **último** segmento não vazio do path, não o primeiro, para continuar funcionando se a
landing algum dia ficar sob um prefixo. E normaliza para minúsculas: `/PH-EMP-X-p1/` e
`/ph-emp-x-p1/` precisam virar o **mesmo** `content_id`, senão o TikTok trata como duas ofertas.

O slug inclui o sufixo `-p1` de propósito — é o identificador daquela página. Se um dia for
preciso agrupar `p1` e `p2` da mesma oferta num `content_id` só, o ajuste é remover o sufixo aqui,
e isso muda o agrupamento no relatório.

### Tag de identify (Custom HTML)

Anexa a identidade ao pixel. Precisa disparar **depois** do código-base, via **Advanced Settings
› Tag Sequencing**, senão o objeto `ttq` ainda não existe e o identify some sem erro.

```html
<script>
  (function () {
    var hash = '{{User Email SHA256}}';
    var pixel = '{{TT - Pixel Code Map}}';

    if (!/^[a-f0-9]{64}$/.test(hash)) return;
    if (!/^[A-Za-z0-9]{15,30}$/.test(pixel)) return;

    if (typeof ttq === 'undefined' || !ttq.instance) return;

    ttq.instance(pixel).identify({ sha256_email: hash });
  })();
</script>
```

Ela continua necessária mesmo com o `Purchase` já carregando o e-mail: o identify grava a
identidade no SDK, que passa a anexá-la aos `Pageview` seguintes. Como `Pageview` é o evento de
maior volume, é ele quem domina a métrica de **cobertura**.

:::perigo Em Custom HTML, chave dupla é substituição de texto — inclusive dentro de comentário
O GTM troca `{{Nome da variável}}` pelo valor cru, sem aspas, em **qualquer** ponto do arquivo.
Duas consequências:

- Sem aspas em volta, a tag quebra inteira.
- Com aspas, quando a variável vem vazia o texto colado é literalmente `undefined` — uma string
  **não-vazia**, que passaria por uma checagem ingênua e mandaria `"undefined"` como e-mail
  hasheado. Por isso todo teste aqui checa o **formato** do valor, nunca se ele "existe".

E vale dentro de comentário também: nunca escreva chave dupla num comentário explicativo.
:::

### Tag da Events API (Custom HTML) — uma só, para os três eventos

Manda a cópia server-side. O `POST` vai para o nosso próprio domínio (`/_tt/event`), e o Worker
repassa ao TikTok.

É **uma tag só**, que decide sozinha quais eventos mandar lendo o `lead=true` da URL:

| Página | O que a tag envia |
|---|---|
| `p1` **sem** `lead=true` (landing) | `ViewContent` |
| `p1` **com** `lead=true` (envio do lead) | `ViewContent` + `CompleteRegistration` + `Purchase` |

Só o `ViewContent` leva `content_id` — a lista `CONTENT_EVENTS` no topo da tag define isso.
As propriedades são **clonadas por evento**: um objeto compartilhado vazaria o `content_id` para
`Purchase` e `CompleteRegistration`, que não o têm do lado do pixel.

O `ViewContent` sai nas duas porque a tag de pixel dele também dispara nas duas. **As duas vias têm
de enviar o mesmo conjunto**: o evento que o pixel manda e a Events API não fica sem par
server-side, e perde a redundância que o quinto item da auditoria pede.

Uma tag e não três porque seriam três cópias do mesmo bloco de sessenta linhas, editadas à mão no
painel. Qualquer correção — um guard, o endpoint, um campo novo no payload — teria de ser aplicada
três vezes, e é questão de tempo até uma das cópias ficar para trás. **Foi exatamente assim que
nove tags acabaram mandando o cookie errado no campo do e-mail.**

O laço manda um `POST` por evento, cada um dentro do seu `try`: um payload problemático não impede
os outros de sair.

```html
<script>
  (function () {
    // ---------------------------------------------------------------------
    // UMA tag para os tres eventos. Ela mesma decide quais mandar, pela URL:
    //   toda p1            -> ViewContent
    //   p1 com lead=true   -> ViewContent + CompleteRegistration + Purchase
    // O ViewContent sai nas duas porque a tag de pixel dele tambem dispara nas
    // duas. As duas vias tem de mandar o MESMO conjunto: o que o pixel manda e a
    // Events API nao, fica sem par server-side.
    // Os nomes tem de ser IDENTICOS ao campo Event das tags de pixel: o TikTok
    // deduplica por (evento, event_id), entao divergir faz o par nao casar.
    var ALWAYS_EVENTS = ['ViewContent'];
    var LEAD_EVENTS   = ['CompleteRegistration', 'Purchase'];

    // Eventos que levam content_id. Acrescentar um nome aqui e tudo que e preciso
    // para estender -- mas o campo tem de ser preenchido na tag de PIXEL do mesmo
    // evento tambem, senao as duas vias mandam propriedades diferentes.
    var CONTENT_EVENTS = ['ViewContent'];
    // O TikTok so aceita 'product' ou 'product_group', e exige content_type junto
    // com content_id. Nossa landing e um item unico, entao 'product'.
    var CONTENT_TYPE   = 'product';
    // ---------------------------------------------------------------------

    // Preencher com o codigo do Test Events APENAS durante a validacao, e ESVAZIAR depois:
    // com valor preenchido, o evento vai para o fluxo de teste e NAO conta na atribuicao.
    var TEST_EVENT_CODE = '';

    var pixel    = '{{TT - Pixel Code Map}}';
    var eventId  = '{{TT - Event ID}}';
    var hash     = '{{User Email SHA256}}';
    var value    = '{{TT - Lead Value}}';
    var currency = '{{TT - Lead Currency}}';
    var ttp      = '{{TT - TTP Cookie}}';
    var ttclid   = '{{TT - TTCLID}}';
    var contentId = '{{TT - Content ID}}';

    // Substituicao textual do GTM: variavel vazia vira a string 'undefined'.
    function ok(v) {
      return !!v && v !== 'undefined' && v !== 'null';
    }

    if (!/^[A-Za-z0-9]{15,30}$/.test(pixel)) return;
    if (!/^tt_[a-z0-9]+_[a-z0-9]+$/.test(eventId)) return;

    // A MESMA condicao do gatilho das tags de pixel do lead. Se um dia o gatilho
    // mudar de criterio, esta linha tem de mudar junto.
    var isLead = /[?&]lead=true/.test(location.search);
    var events = isLead ? ALWAYS_EVENTS.concat(LEAD_EVENTS) : ALWAYS_EVENTS;

    var user = {};
    if (/^[a-f0-9]{64}$/.test(hash)) user.email = hash; // ja hasheado; o Worker repassa
    if (ok(ttp)) user.ttp = ttp;                        // identificadores: em claro
    if (ok(ttclid)) user.ttclid = ttclid;

    var baseProps = {};
    var v = parseFloat(value);
    if (!isNaN(v)) baseProps.value = v;                 // numero, nunca string
    if (/^[A-Z]{3}$/.test(currency)) baseProps.currency = currency;

    // Mesma lista que o Worker aceita. Um nome fora dela volta 400 e o .catch()
    // engoliria o erro -- o evento sumiria sem sintoma.
    var ALLOWED_EVENTS = ['Purchase', 'CompleteRegistration', 'ViewContent', 'Pageview', 'Lead'];

    for (var i = 0; i < events.length; i++) {
      // try por evento: um payload problematico nao pode impedir os outros de sair.
      try {
        var eventName = events[i];
        if (ALLOWED_EVENTS.indexOf(eventName) === -1) continue;

        // Copia por evento: content_id vale so para alguns, e um objeto
        // compartilhado vazaria o campo para os demais.
        var props = {};
        for (var k in baseProps) {
          if (Object.prototype.hasOwnProperty.call(baseProps, k)) props[k] = baseProps[k];
        }
        if (CONTENT_EVENTS.indexOf(eventName) !== -1 && ok(contentId)) {
          props.content_id = contentId;
          props.content_type = CONTENT_TYPE;
        }

        var body = {
          pixel_id: pixel,
          event: eventName,
          event_id: eventId,
          timestamp: Date.now(),
          page: { url: location.href },
          user: user,
          properties: props
        };
        if (document.referrer) body.page.referrer = document.referrer;
        if (ok(TEST_EVENT_CODE)) body.test_event_code = TEST_EVENT_CODE;

        // Same-origin de proposito: sem preflight, sem CORS, e o cookie cf_clearance
        // viaja (a regra WAF "WINDOWS BOT" da zona avalia antes do Worker).
        // keepalive: a p1 costuma navegar logo em seguida, e sem isso o browser aborta
        // a requisicao no unload e o evento se perde.
        fetch('/_tt/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          keepalive: true
        }).catch(function () {});
      } catch (e) {}
    }
  })();
</script>
```

O `keepalive` é o que permite a requisição sobreviver à saída da página — sem ele, conversões que
redirecionam perdem o evento.

:::atencao O lado do pixel continua sendo uma tag por evento
Lá não dá para unificar: o template oficial do TikTok manda **um** evento por tag. Então são três
tags de pixel e uma da Events API — a assimetria é da ferramenta, não do desenho.
:::

:::perigo A condição `lead=true` aparece em dois lugares e precisa concordar
O gatilho das tags de pixel do lead usa `lead=true`, e esta tag repete a mesma condição no código
para decidir o que enviar. Se um dia o critério de conversão mudar, **os dois têm de mudar
juntos** — senão as duas vias passam a mandar conjuntos diferentes na mesma pageview, e o que
sobrar de um lado só fica sem par.
:::

:::atencao O Worker não precisa de mudança para os eventos novos
Ele já aceita `Purchase`, `CompleteRegistration`, `ViewContent`, `Pageview` e `Lead`. Um nome fora
dessa lista volta **400**, e o `.catch()` da tag engole o erro — o evento sumiria sem sintoma. Por
isso a tag valida o nome antes de enviar, em vez de deixar o Worker recusar.
:::

### O gatilho da tag da Events API

É o mesmo gatilho **p1** usado pelo `ViewContent` do pixel. Ele não filtra `lead=true`: cobre a
landing **e** a conversão, e deixa a decisão de quais eventos enviar para o código.

```
Page Path    contém   /<país>-
Page Path    contém   -p1
Page URL     contém   utm_source=tiktok
```

:::perigo Não reaproveite o gatilho do código-base
Existe no container um gatilho parecido, mas é ele que dispara a tag de **código-base** — e os
filtros dele **não são os mesmos**: no piloto ele usa `p1/` e `utm source`, enquanto o **p1** usa
`-p1` e `utm_source=tiktok`, para espelhar o gatilho de lead.

Além de casar páginas ligeiramente diferentes, reaproveitá-lo criaria um acoplamento silencioso:
qualquer ajuste feito nele por motivo de código-base passaria a mexer na Events API. Crie um
gatilho próprio.
:::

## Como validar

Valide no **Preview do GTM**, antes de publicar: ele roda só no seu navegador e os eventos chegam
de verdade no Test Events. Não é preciso publicar para testar.

1. No painel do TikTok, abra **Test Events** e copie o código de teste.
2. Preencha `TEST_EVENT_CODE` no topo da tag da Events API.
3. **Passe pelo quiz e informe o e-mail** no mesmo navegador. Sem isso a variável
   `User Email SHA256` vem vazia e os eventos saem sem PII — parece bug e não é.
4. Percorra os dois cenários abaixo.
5. **Esvazie o `TEST_EVENT_CODE`** e só então publique.

### Cenário 1 — landing, sem `lead=true`

| | |
|---|---|
| **Dispara** | código-base, `ViewContent` (pixel), `Events API` |
| **Não dispara** | `Identify`, `CompleteRegistration`, `Purchase` |
| **Test Events** | `Pageview` + `ViewContent` **duas vezes**, mesmo `event_id` |
| **Network** | **1** `POST /_tt/event` → 200 |

As duas cópias do `ViewContent` têm de trazer `content_id` igual ao slug da página e
`content_type: product`. Se aparecer numa via e não na outra, as propriedades divergiram entre
browser e servidor.

O `ViewContent` daqui sai sem e-mail: o usuário ainda não deu o dele.

### Cenário 2 — conversão, com `lead=true`

| | |
|---|---|
| **Dispara** | código-base, `Identify`, `ViewContent`, `CompleteRegistration`, `Purchase`, `Events API` |
| **Test Events** | `ViewContent`, `CompleteRegistration` e `Purchase`, **cada um duas vezes**, os seis com o **mesmo `event_id`** |
| **Network** | **3** `POST /_tt/event` → 200 |

Cada evento chegando **duas vezes com o mesmo `event_id`** é o teste que importa: é o único jeito
de saber que a redundância não virou contagem dobrada. Confirme também que o `Purchase` traz e-mail
hasheado, `value` numérico puro e moeda em três letras.

E confira o caso negativo do `content_id`: ele tem de aparecer **só no `ViewContent`**. Se vazar
para `Purchase` ou `CompleteRegistration`, as propriedades estão sendo compartilhadas entre os
eventos em vez de clonadas — e aí as duas vias divergem, porque do lado do pixel esses dois não
têm o campo.

Nas Variables do Preview, confira os valores resolvidos — não basta a tag ter disparado:
`TT - Pixel Code Map`, `TT - Event ID` (`tt_...`), `TT - Lead Value`, `TT - Lead Currency`,
`TT - Content ID` (o slug da página) e `User Email SHA256` com 64 caracteres hex.

:::perigo Esquecer de esvaziar o código de teste custa conversão
Com ele preenchido, o evento vai para o fluxo de teste e **não conta na atribuição**. Não aparece
erro em lugar nenhum — a campanha simplesmente para de receber sinal.
:::

:::atencao Erros de rota aparecem no Network, não no GTM
O `POST` tem um `.catch()` vazio, então falha em silêncio. **403** é regra de WAF barrando antes do
Worker; **404** costuma ser a rota da Cloudflare sem o `/*` final.
:::

### Depois de publicar

Leia os indicadores na visão de qualidade do pixel só depois de **24 a 48 horas** — o Test Events
mostra evento individual em tempo real, e os quatro indicadores da auditoria são métricas agregadas,
em outro lugar do painel.

Acompanhe o volume por dia na virada:

- `Purchase` e `CompleteRegistration` **estáveis**. Se dobrar, a regra do Events Builder não saiu
  (passo 5). Se cair, o gatilho ficou mais estreito que a regra antiga (passo 2).
- `ViewContent` **acima** dos outros dois — é o degrau do funil. Se vier igual, o gatilho dele não
  é o **p1**.

## Onde cada conta está hoje

As cinco contas auditadas **não incluem as Filipinas** — o piloto foi canário de propósito. A
reauditoria vai medir estas cinco, então pedir nova auditoria antes de o rollout alcançá-las não
muda indicador nenhum.

| Conta auditada | Superfície | Container | Situação |
|---|---|---|---|
| `[NX]br.emp.utua.com.br` | `utua.com.br` | `GTM-T48CH8D` | tag existe, mas manda o cookie errado no campo do e-mail |
| `[NX]us.cc.utua.com.br` | `utua.com.br` | `GTM-T48CH8D` | mesma situação |
| `[NX]mx.emp.utua.com.br` | `utua.com.br` | `GTM-T48CH8D` | tags **pausadas** |
| `[NX]uk.cc.utua.uk` | `utua.uk` | `GTM-M4B8JVS9` | container **sem nenhuma** tag do TikTok |
| `[NX]jp.cc.utua.com` | `utua.com` | `GTM-5PW5333V` | container **sem nenhuma** tag do TikTok |

:::atencao Por onde começar
Nove tags já existem, já estão ativas e já mandam e-mail — só mandam o **valor errado** (um
cookie que não é o SHA-256). Trocar a variável nelas fecha os itens 1 e 2 em BR, USA, ZA, PE, JP
e TR **sem criar tag nenhuma**. É o caminho mais curto até as contas que a auditoria mediu.

O mapeamento de conta para container acima veio do **nome da conta**, não de medição. Confirme no
painel antes de começar por `uk.cc` ou `jp.cc`.
:::

## Pendências

Questões levantadas ao fechar a primeira fase com PH rodando. Nenhuma delas invalida o que
está no ar. A primeira já tem desenho decidido e espera o momento de aplicar; as outras duas
aguardam decisão ou diagnóstico confirmado.

### 1. Um país com mais de um pixel — desenho decidido, ainda não aplicado

A conta de anúncios costuma ser por **vertical**: um pixel para cartão (`cc`) e outro para
empréstimo (`emp`). O desenho atual não expressa isso — `TT - Pixel Code Map` é indexada só pelo
país, e a tag de código-base carrega um pixel com o ID escrito literalmente nela.

Não é hipotético: no container, `br`, `usa`, `ar`, `co` e `ca` já aparecem com dois ou três
pixels cada, e existem **26 tags de código-base para 26 pixels**.

:::perigo Nos países multi-pixel, hoje os dois pixels carregam em toda página
As duas tags de código-base de `br` compartilham o **mesmo acionador** (`p1/` + `/br-` +
`tiktok`), e o mesmo vale para `usa`. Como o acionador olha só o país, ele não separa vertical:
cada pixel recebe `Pageview` de cartão **e** de empréstimo.

Se a intenção é um pixel por vertical, as duas contas estão medindo tráfego da outra. Isso é
anterior a este trabalho e não afeta PH — que tem um pixel só —, mas **precisa ser corrigido
antes de replicar para esses países**, ou o problema vira o normal.
:::

**A solução são duas metades, cada uma no seu mecanismo:**

| Peça | Mecanismo | Resolve |
|---|---|---|
| Tag de código-base | **acionador por path** | qual pixel **carrega** na página |
| `Identify`, `Purchase`, `Events API` | **Lookup chaveada por `país-vertical`** | para qual pixel o evento **vai** |

O acionador por path aproveita que a URL sempre segue `/<país>-<vertical>-<produto>-<tipo>`:
um acionador `contém /ph-emp-` para a tag do pixel de emprestimo, outro `contém /ph-cc-` para a
de cartão. É o padrão que o container já usa — hoje o acionador só para no país, e passa a ir
até a vertical.

A segunda metade é barata: a variável de país **já captura** a vertical na regex
`/^\/([a-z]{2,3})-(emp|cc)-/` e descarta o grupo 2. Devolvendo `país-vertical` (`ph-emp`), a
Lookup do pixel passa a resolver por vertical. Sem isso, o pixel certo carregaria mas o
`Purchase` continuaria indo para o único pixel que a tabela devolve para aquele país.

:::atencao Use o hífen final no acionador
`contém /ph-emp-`, não `/ph-emp`. Sem o hífen, uma vertical futura como `empresas` casaria os
dois acionadores e carregaria dois pixels na mesma página. É a mesma classe do erro que deixou
as `/ph-cc-` de fora.
:::

Foi descartado colapsar as 26 tags de base numa só que lesse a Lookup. Daria (a tag é Custom
HTML, aceita variável), mas mexeria em 20 países de uma vez para economizar tags — enquanto
dividir acionador é edição de gatilho, sem tocar em código que já funciona.

**Por que ainda não foi aplicado:** PH tem um pixel só, servindo as duas verticais, então o
problema não aparece aqui. A mudança entra quando o primeiro país multi-pixel — ou uma vertical
nova — entrar no fluxo.

Fica em aberto se `value` e `currency` devem passar a variar por vertical. Cartão e empréstimo
não têm o mesmo RPM, então o `0.8` único provavelmente não serve para os dois — mas isso é
calibração de negócio, não limitação técnica.

### 2. `value` e `currency` nos eventos de topo de funil — a decidir

As três tags de conversão mandam `value: 0.8` e `currency: BRL`, inclusive o `ViewContent`. Foi
assim que os eventos novos nasceram, copiados da tag de `Purchase`, e as duas vias (pixel e
Events API) estão consistentes entre si.

Fica a decidir se `ViewContent` deve mesmo carregar valor de compra. Não afeta o ROAS de
`Purchase` — o TikTok calcula por evento —, mas infla qualquer métrica que some valor entre
eventos e faz um evento de topo de funil parecer receita.

:::atencao Se mudar, mude nos dois lados juntos
A tag de pixel e a da Events API precisam mandar os mesmos `value` e `currency`. Alterar só uma
das vias cria divergência entre o que o browser e o servidor reportam para a mesma conversão.
:::

### 3. Cobertura de cookie first-party: 43% no servidor, 98% no browser

O painel do TikTok reporta, nas chaves de deduplicação:

| Chave | Browser | Servidor |
|---|---|---|
| `event_id` | 100% | 100% |
| Cookies first-party | 98% | **43%** |

:::atencao Isto não é contagem dobrada
`event_id` em 100% dos dois lados significa que a **deduplicação está funcionando** — nenhuma
conversão está sendo contada duas vezes. O que a lacuna de cookie custa é **qualidade de match e
atribuição** na via server-side, não a correção do número.
:::

**Suspeita principal, com evidência:** das três tags do gatilho, a da Events API é a **única sem
Tag Sequencing**. `Purchase` e `Identify` esperam o código-base; a da Events API não espera nada.
Ou seja, ela é a que lê o cookie `_ttp` mais cedo — e `_ttp` é escrito pelo SDK do TikTok durante
a inicialização dele. Ler antes disso devolve vazio.

Some-se um segundo efeito: a tag captura o valor por `{{TT - TTP Cookie}}`, e a substituição do
GTM é **textual, no momento em que a tag é avaliada**. O valor fica congelado ali, mesmo que o
`fetch` só saia depois — então esperar não adianta se a leitura já aconteceu.

Correções, da mais barata para a mais cara:

1. **Ligar Tag Sequencing** na tag da Events API, igual às outras duas. É uma caixa de seleção.
2. **Ler o `_ttp` de `document.cookie` dentro da própria tag**, no momento do envio, em vez de
   receber o valor pronto pela variável do GTM. Resolve o congelamento.
3. Se ainda ficar curto, adiar o envio — com cuidado: atrasar demais arrisca perder o evento na
   saída da página, que é justamente o que o `keepalive` existe para evitar.

Depois de aplicar, **medir de novo no painel** antes de concluir. A hipótese acima explica o
formato do número, mas não foi confirmada por medição.

## Referências

- Repos: `service-tiktok-events` — o Worker da Events API
- Containers: `GTM-T48CH8D` (`utua.com.br` + quizzes), `GTM-M4B8JVS9` (`utua.uk`),
  `GTM-5PW5333V` (`utua.com`), `GTM-T72VQQPR` (rede `wp-clones`)
- [Eventos padrão do TikTok e a renomeação de 01/05/2025](https://ads.tiktok.com/resources/help/article/how-to-adopt-tiktoks-updated-standard-events?lang=pt)
  — `CompletePayment` virou `Purchase` e `SubmitForm` virou `Lead`. Os nomes antigos ainda
  funcionam, mas ao criar tag nova use os novos.
