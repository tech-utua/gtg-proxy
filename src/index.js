// gtg-proxy
// Cloudflare Worker que implementa o Google Tag Gateway manualmente
// como proxy reverso first-party para domínios servidos via Cloudflare.
//
// Cobertura inicial: GTM containers, GA4 properties e Google Ads.
// Veja README para a lista de mapeamentos em produção.

const TAG_UPSTREAMS = {
  "GTM-KLGPQCKL": "gtm-klgpqckl.fps.goog",
  "AW-659095278": "aw-659095278.fps.goog",
  "G-DCFVCWRHN9": "g-dcfvcwrhn9.fps.goog",
  "GTM-MFK4MDQ9": "gtm-mfk4mdq9.fps.goog",
  "G-SFM5F23YPQ": "g-sfm5f23ypq.fps.goog",

  // Adicionar aqui novas tags:
  // "G-XXXXXXX": "g-xxxxxxx.fps.goog",
};

// Tag default por hostname — usado em paths sem ?id= nem ?tid=
// (ex: /_ev/healthy, /_ev/validate_geo)
const DEFAULT_TAG_FOR_HOST = {
  "utua.lv": "GTM-KLGPQCKL",
  "utua.de": "GTM-MFK4MDQ9",
};

const MEASUREMENT_PATH = "/_ev";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();

    if (!url.pathname.startsWith(MEASUREMENT_PATH)) {
      return new Response("Not found", { status: 404 });
    }

    // Roteamento por prioridade:
    // 1. ?id=XXX  — bootstrap (gtm.js, gtag/js, /debug/*)
    // 2. ?tid=XXX — hits de medição (/g/collect, /r/collect)
    // 3. default por hostname — endpoints sem identificador
    const idParam = url.searchParams.get("id");
    const tidParam = url.searchParams.get("tid");
    const candidateId = idParam || tidParam || DEFAULT_TAG_FOR_HOST[hostname];

    const upstreamHost = TAG_UPSTREAMS[candidateId];
    if (!upstreamHost) {
      return new Response(
        `No upstream mapping for tag id "${candidateId}" on ${hostname}`,
        { status: 404 }
      );
    }

    // Preserva path inteiro (incluindo /_ev) + query string ao proxar.
    // O measurement path precisa chegar ao Google tal qual configurado no GTG.
    const upstreamUrl = new URL(
      url.pathname + url.search,
      `https://${upstreamHost}`
    );

    const cf = request.cf || {};
    const country = cf.country || "";
    const region = cf.regionCode || "";

    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.set("Host", upstreamHost);

    if (country && region) {
      upstreamHeaders.set("X-Forwarded-CountryRegion", `${country}-${region}`);
    }
    if (country) upstreamHeaders.set("X-Forwarded-Country", country);
    if (region) upstreamHeaders.set("X-Forwarded-Region", region);

    upstreamHeaders.set("Origin", url.origin);
    upstreamHeaders.set(
      "Referer",
      request.headers.get("Referer") || url.origin
    );

    upstreamHeaders.delete("cf-connecting-ip");
    upstreamHeaders.delete("cf-ipcountry");
    upstreamHeaders.delete("cf-ray");
    upstreamHeaders.delete("cf-visitor");
    upstreamHeaders.delete("cf-worker");

    let response;
    try {
      response = await fetch(upstreamUrl.toString(), {
        method: request.method,
        headers: upstreamHeaders,
        body: request.body,
        redirect: "follow",
      });
    } catch (err) {
      return new Response(`Upstream fetch error: ${err.message}`, {
        status: 502,
      });
    }

    // Remove Domain= dos Set-Cookie para que os cookies fiquem host-only
    // no domínio do site, e não em .fps.goog — ponto que sustenta a
    // propriedade "first-party" do GTG.
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("alt-svc");

    const setCookies = [];
    for (const [key, value] of response.headers) {
      if (key.toLowerCase() === "set-cookie") {
        setCookies.push(value.replace(/;\s*Domain=[^;]+/gi, ""));
      }
    }
    if (setCookies.length > 0) {
      responseHeaders.delete("set-cookie");
      for (const c of setCookies) responseHeaders.append("set-cookie", c);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  },
};
