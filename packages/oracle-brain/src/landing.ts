import { FREE_TOOLS, PAID_TOOLS, SERVICE, clampPrice } from "./catalog.js";
import type { OracleEnv } from "./env.js";
import { jsonLd } from "./discovery.js";

export function landingHtml(env: OracleEnv): string {
  const ld = JSON.stringify(jsonLd(env));
  const rows = [
    ...FREE_TOOLS.map(
      (t) =>
        `<div class="row"><span>${t.name}</span><span class="free">free</span><span>${t.httpPath}</span></div>`,
    ),
    ...PAID_TOOLS.map(
      (t) =>
        `<div class="row"><span>${t.name}</span><span class="price">$${clampPrice(t, undefined, env.maxPriceUsd)}</span><span>${t.httpPath}</span></div>`,
    ),
  ].join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>x402 Oracle — 402 is the answer</title>
<script type="application/ld+json">${ld}</script>
<style>
:root{--basalt:#161310;--vellum:#e8dcc4;--brass:#b08d57;--crimson:#9b1b2e;--rule:rgba(176,141,87,.35)}
body{margin:0;background:#161310;color:var(--vellum);font-family:Palatino,Georgia,serif}
.slit-wrap{max-width:920px;margin:0 auto;padding:48px 24px;display:grid;grid-template-columns:28px 1fr;gap:28px}
.slit{width:2px;background:linear-gradient(180deg,transparent,var(--brass),var(--crimson),var(--brass),transparent)}
.ledger{border:1px solid var(--rule);padding:36px}
h1{font-weight:500;font-size:48px;margin:0 0 8px}
.thesis{color:#c43b4e;font-size:22px}
.row{display:grid;grid-template-columns:1fr auto auto;gap:12px;border-bottom:1px dashed var(--rule);padding:8px 0;font-family:ui-monospace,monospace;font-size:13px}
.price{color:#d4b483} a{color:#d4b483}
pre{background:#110e0c;border:1px solid var(--rule);padding:16px;overflow:auto}
</style>
</head>
<body>
<main class="slit-wrap">
<div class="slit"></div>
<article class="ledger">
<p>Inscribed ledger · ${SERVICE.slug}</p>
<h1>${SERVICE.name}</h1>
<p class="thesis">${SERVICE.thesis}</p>
<p>Humans get calm prose. Agents get JSON + an implementation prompt. Never send private keys.</p>
<div class="menu">${rows}</div>
<pre>curl -s ${env.publicBaseUrl}/api/consult/oracle_ask -H 'content-type: application/json' -d '{"question":"Why no Bazaar rank after 402s?"}'</pre>
<p><a href="/llms.txt">llms.txt</a> · <a href="/.well-known/x402">/.well-known/x402</a> · <a href="/mcp">/mcp</a></p>
<footer>payTo ${env.payTo} · ${env.network} · not a token, not equity</footer>
</article>
</main>
</body>
</html>`;
}
