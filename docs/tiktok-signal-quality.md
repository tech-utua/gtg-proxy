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
updated: 2026-08-20
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

Depois do corte, cada página de conversão das Filipinas dispara exatamente isto:

| Evento | Quem dispara | O que carrega |
|---|---|---|
| `Pageview` | o código-base do pixel | identidade, via tag de identify |
| `Purchase` | tag do GTM, pelo pixel | e-mail hasheado + valor + moeda + `event_id` |
| `Purchase` | tag do GTM, pela Events API | os mesmos campos + `ttclid`, `ttp` e IP/User-Agent reais |

Os dois `Purchase` **não** viram duas conversões: carregam o mesmo `event_id`, e o TikTok
deduplica por `(evento, event_id)`. É essa redundância que atende ao quinto item da auditoria —
se o navegador falhar, bloquear anúncio ou perder a rede, a via server-side ainda entrega.

**Nenhuma regra sobrou no Events Builder do pixel.** É intencional, e o passo 5 explica.

## Antes de começar

Confirme três coisas para o país que vai replicar. Todas já causaram retrabalho:

1. **Qual superfície recebe o tráfego pago da conta** — e, portanto, qual container do GTM. Não
   deduza pelo nome da conta: `[NX]uk.cc.utua.uk` e `[NX]jp.cc.utua.com` rodam em containers
   diferentes dos demais, e esses containers não têm nada montado.
2. **Qual o alcance real da regra do Events Builder** que você vai substituir. Abra a regra e
   leia a condição inteira antes de escrever o gatilho da tag.
3. **Se o país já tem tag do TikTok no container.** Vários já têm — e nesses casos o trabalho é
   *corrigir* a tag existente, não criar outra.

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

### 2. Crie o gatilho cobrindo as páginas do país

:::perigo O gatilho tem que cobrir o mesmo alcance da regra que você vai remover
No piloto o gatilho nasceu exigindo a vertical (`/ph-emp-`), enquanto a regra removida casava só
`lead=true`, **sem prefixo de vertical**. Resultado: 105 páginas `/ph-cc-*` ficaram sem
`Purchase` por seis dias, sem erro nenhum aparecer.

O gatilho correto do piloto ficou `Page Path` **contém** `/ph-`. Confira o alcance da regra
antiga antes de escrever o seu.
:::

### 3. Clone as três tags do piloto

`Identify`, `Purchase` e `Events API` — o código de cada uma está mais abaixo. As três usam o
**mesmo gatilho** do passo 2 e disparam na mesma exibição de página.

### 4. Acrescente o pixel e o token ao Worker

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

:::perigo Access token não circula por Slack nem entra em arquivo
O token vai direto no segredo do Worker, por quem tem acesso ao painel da Cloudflare. Ele nunca
toca o navegador — é justamente por isso que a chamada passa pelo Worker em vez de ir do
navegador direto ao TikTok.
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

:::perigo A lista de verticais é fechada — vertical nova não dispara
O padrão reconhecido é `/<país>-<vertical>-<oferta>-p1/`, e a vertical só casa se for `emp` ou
`cc`. Qualquer outra devolve vazio, a tabela não resolve e **a tag não dispara** — sem erro
nenhum, exatamente como no caso das `/ph-cc-*`.

Isso já está acontecendo: as Filipinas têm **três páginas `/ph-finance-*`** no ar
(`digital-payments`, `mga-pandaraya-sa-pananalapi`, `pag-ibig`) que ficam fora da medição. Se
essas páginas receberem mídia paga, a conversão não é registrada.

Ao replicar, **liste as verticais do país** antes de assumir que `emp|cc` cobre tudo — e
acrescente as que faltarem à alternância `(emp|cc)` do código acima.
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

### Tag da Events API (Custom HTML)

Manda a cópia server-side. O `POST` vai para o nosso próprio domínio (`/_tt/event`), e o Worker
repassa ao TikTok.

```html
<script>
  (function () {
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

    // Substituicao textual do GTM: variavel vazia vira a string 'undefined'.
    function ok(v) {
      return !!v && v !== 'undefined' && v !== 'null';
    }

    if (!/^[A-Za-z0-9]{15,30}$/.test(pixel)) return;
    if (!/^tt_[a-z0-9]+_[a-z0-9]+$/.test(eventId)) return;

    var user = {};
    if (/^[a-f0-9]{64}$/.test(hash)) user.email = hash; // ja hasheado; o Worker repassa
    if (ok(ttp)) user.ttp = ttp;                        // identificadores: em claro
    if (ok(ttclid)) user.ttclid = ttclid;

    var props = {};
    var v = parseFloat(value);
    if (!isNaN(v)) props.value = v;                     // numero, nunca string
    if (/^[A-Z]{3}$/.test(currency)) props.currency = currency;

    var body = {
      pixel_id: pixel,
      event: 'Purchase',
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
  })();
</script>
```

O `keepalive` é o que permite a requisição sobreviver à saída da página — sem ele, conversões
que redirecionam perdem o evento.

## Como validar

1. No painel do TikTok, abra **Test Events** e copie o código de teste.
2. Preencha `TEST_EVENT_CODE` no topo da tag da Events API, publique e navegue por uma página de
   conversão real do país.
3. Confirme que chegam **dois `Purchase`** e que ambos trazem o **mesmo `event_id`**. Esse é o
   teste que importa: é o único jeito de saber que a redundância não virou contagem dobrada.
4. Confirme que o `Purchase` traz e-mail hasheado, `value` numérico puro e moeda em três letras.
5. **Esvazie o `TEST_EVENT_CODE`** e publique de novo.

:::perigo Esquecer de esvaziar o código de teste custa conversão
Com ele preenchido, o evento vai para o fluxo de teste e **não conta na atribuição**. Não aparece
erro em lugar nenhum — a campanha simplesmente para de receber sinal.
:::

Depois de 24 a 48 horas, leia os quatro indicadores na visão de qualidade do pixel. O Test Events
mostra evento individual em tempo real; os indicadores da auditoria são **métricas agregadas** e
ficam em outro lugar do painel.

E acompanhe o volume de `Purchase` por dia na virada: ele deve ficar **estável**. Se dobrar, a
regra do Events Builder não saiu (passo 5). Se cair, o gatilho está mais estreito que a regra
antiga (passo 2).

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

## Referências

- Repos: `service-tiktok-events` — o Worker da Events API
- Containers: `GTM-T48CH8D` (`utua.com.br` + quizzes), `GTM-M4B8JVS9` (`utua.uk`),
  `GTM-5PW5333V` (`utua.com`), `GTM-T72VQQPR` (rede `wp-clones`)
- [Eventos padrão do TikTok e a renomeação de 01/05/2025](https://ads.tiktok.com/resources/help/article/how-to-adopt-tiktoks-updated-standard-events?lang=pt)
  — `CompletePayment` virou `Purchase` e `SubmitForm` virou `Lead`. Os nomes antigos ainda
  funcionam, mas ao criar tag nova use os novos.
