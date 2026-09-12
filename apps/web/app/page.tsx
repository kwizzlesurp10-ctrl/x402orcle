import { PAID_TOOLS, FREE_TOOLS, SERVICE, clampPrice, landingConsultCopy } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../lib/env";

export default function Page() {
  const env = oracleEnv();
  const consult = landingConsultCopy(env);

  return (
    <main className="slit-wrap" itemScope itemType="https://schema.org/SoftwareApplication">
      <div className="slit" aria-hidden="true" />
      <article className="ledger">
        <header>
          <p className="kicker">Inscribed ledger · {SERVICE.slug} · Base USDC ({env.network})</p>
          <h1 itemProp="name">{SERVICE.name}</h1>
          <p className="thesis" itemProp="headline">{SERVICE.thesis}</p>
        </header>

        <section itemProp="description">
          <p>
            Humans get calm prose and a copy-paste prompt. Agents get compact JSON, a
            receipt, and an implementation prompt they can hand to their builder.
            The Oracle never asks for private keys. Seller hosts take a receive
            address only.
          </p>
        </section>

        <section aria-label="Oracle Capability Menu" className="menu">
          {FREE_TOOLS.map((t) => (
            <div
              className="row"
              key={t.name}
              itemProp="offers"
              itemScope
              itemType="https://schema.org/Offer"
            >
              <span itemProp="name">{t.name}</span>
              <span className="free">
                <meta itemProp="price" content="0" />
                <meta itemProp="priceCurrency" content="USD" />
                free
              </span>
              <span itemProp="url">{t.httpPath}</span>
            </div>
          ))}
          {PAID_TOOLS.map((t) => {
            const price = clampPrice(t, undefined, env.maxPriceUsd);
            return (
              <div
                className="row"
                key={t.name}
                itemProp="offers"
                itemScope
                itemType="https://schema.org/Offer"
              >
                <span itemProp="name">{t.name}</span>
                <span className="price">
                  <meta itemProp="price" content={String(price)} />
                  <meta itemProp="priceCurrency" content="USD" />
                  ${price}
                </span>
                <span itemProp="url">{t.httpPath}</span>
              </div>
            );
          })}
        </section>

        <section aria-label="Consultation Example">
          <p>{consult.caption}</p>
          <pre><code>{consult.commands}</code></pre>
        </section>

        <nav aria-label="Machine Discovery Surfaces">
          <p>
            Machine surfaces:{" "}
            <a href="/.well-known/x402" title="x402 Protocol Manifest">/.well-known/x402</a> ·{" "}
            <a href="/llms.txt" title="LLMs.txt Discovery">/llms.txt</a> ·{" "}
            <a href="/llms-full.txt" title="Full LLMs Reference">/llms-full.txt</a> ·{" "}
            <a href="/.well-known/agent-card.json" title="A2A Agent Card">agent-card</a> ·{" "}
            <a href="/.well-known/mcp.json" title="MCP Manifest">mcp.json</a> ·{" "}
            <a href="/.well-known/funding.json" title="Funding Details">funding.json</a> ·{" "}
            <a href="/openapi.json" title="OpenAPI 3.1 Specification">/openapi.json</a> ·{" "}
            <a href="/mcp" title="Streamable MCP Gateway">/mcp</a> ·{" "}
            <a href="/agents.txt" title="Agents.txt Permissions">/agents.txt</a> ·{" "}
            <a href="/jsonld" title="Schema.org JSON-LD Graph">/jsonld</a>
          </p>
        </nav>

        <footer>
          payTo {env.payTo} · {env.network} · MAX_PRICE_USD={env.maxPriceUsd} ·
          payment for consult artifacts, not a token, not equity.
        </footer>
      </article>
    </main>
  );
}
