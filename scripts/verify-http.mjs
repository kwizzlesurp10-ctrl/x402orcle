#!/usr/bin/env node
const base = process.env.ORACLE_BASE || "http://127.0.0.1:4021";

async function main() {
  const health = await fetch(`${base}/health`).then((r) => r.json());
  if (!health.ok || health.wallet_configured) {
    throw new Error(`health failed: ${JSON.stringify(health)}`);
  }
  const llms = await fetch(`${base}/llms.txt`).then((r) => r.text());
  if (!llms.includes("payTo") && !llms.includes("0x")) throw new Error("llms.txt missing payTo");
  const landing = await fetch(`${base}/`).then((r) => r.text());
  if (!landing.includes("application/ld+json")) throw new Error("missing JSON-LD");
  if (!landing.includes("402 is the answer")) throw new Error("missing thesis");
  const ask = await fetch(`${base}/api/consult/oracle_ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "rank?" }),
  });
  if (ask.status !== 402) throw new Error(`expected 402 got ${ask.status}`);
  const hdr = ask.headers.get("payment-required");
  if (!hdr) throw new Error("missing PAYMENT-REQUIRED");
  const pr = JSON.parse(Buffer.from(hdr, "base64").toString("utf8"));
  if (!pr.extensions?.bazaar?.info?.input?.method) throw new Error("missing bazaar");
  console.log(JSON.stringify({ ok: true, base, payTo: health.pay_to_configured, bazaar: true }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
