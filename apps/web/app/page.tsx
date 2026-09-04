import { PAID_TOOLS, FREE_TOOLS, SERVICE, clampPrice } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../lib/env";

export default function Page() {
  const env = oracleEnv();
  const ask = `${env.publicBaseUrl}/api/consult/oracle_ask`;
  return (
    <main className="slit-wrap">
      <div className="slit" aria-hidden="true" />
      <article className="ledger">
        <p className="kicker">Inscribed ledger · {SERVICE.slug} · Base USDC</p>
        <h1>{SERVICE.name}</h1>
        <p className="thesis">{SERVICE.thesis}</p>
        <p>
          Humans get calm prose and a copy-paste prompt. Agents get compact JSON, a
          receipt, and an implementation prompt they can hand to their builder.
          The Oracle never asks for private keys. Seller hosts take a receive
          address only.
        </p>
        <div className="menu">
          {FREE_TOOLS.map((t) => (
            <div className="row" key={t.name}>
              <span>{t.name}</span>
              <span className="free">free</span>
              <span>{t.httpPath}</span>
            </div>
          ))}
          {PAID_TOOLS.map((t) => (
            <div className="row" key={t.name}>
              <span>{t.name}</span>
              <span className="price">${clampPrice(t, undefined, env.maxPriceUsd)}</span>
              <span>{t.httpPath}</span>
            </div>
          ))}
        </div>
        <p>First successful paid consult (demo mint, then 402 envelope):</p>
        <pre>{`curl -s ${env.publicBaseUrl}/v1/demo/mint-payment -H 'content-type: application/json' -d '{"tool":"oracle_ask"}'
curl -s -X POST ${ask} \\
  -H 'content-type: application/json' \\
  -H "PAYMENT-SIGNATURE: $SIG" \\
  -d '{"question":"Why is my Bazaar listing unranked after 402s?"}'`}</pre>
        <p>
          Machine surfaces:{" "}
          <a href="/.well-known/x402">/.well-known/x402</a> ·{" "}
          <a href="/llms.txt">/llms.txt</a> ·{" "}
          <a href="/.well-known/agent-card.json">agent-card</a> ·{" "}
          <a href="/mcp">/mcp</a>
        </p>
        <footer>
          payTo {env.payTo} · {env.network} · MAX_PRICE_USD={env.maxPriceUsd} ·
          payment for consult artifacts, not a token, not equity.
        </footer>
      </article>
    </main>
  );
}
