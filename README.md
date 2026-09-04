# x402 Oracle (`x402orcle`)

**402 is the answer. The Oracle is how you ask.**

Paid MCP + HTTP 402 wisdom market for x402 / MCP / A2A / Bazaar. Seller-only public host. Base USDC (`eip155:8453`).

## Discover

| Surface | Path |
| --- | --- |
| Landing | `/` |
| Catalog | `/.well-known/x402` |
| MCP | `/mcp` streamable HTTP JSON-RPC + `/.well-known/mcp.json` |
| A2A | `/.well-known/agent-card.json` |
| Fund | `/.well-known/funding.json` |
| LLMs | `/llms.txt` |
| Agents | `/agents.txt` |
| OpenAPI | `/openapi.json` (`x-payment-info`) |

## Tools

Free: `oracle_health`, `oracle_pricing`  
Paid: `oracle_ask` $0.10 · `oracle_diagnose_402` $0.50 · `oracle_review_mcp` $3 · `oracle_bazaar_rewrite` $1.50 · `complete_oracle_task` $10 (clamped to `MAX_PRICE_USD=25`)

Paid replies are a **wisdom envelope**: verdict, wisdom, implementation_prompt, risk, citations, receipt.

## Env (never a spend key)

```
X402_PAY_TO=0x…                 # 42-char address only
X402_NETWORK=eip155:8453
X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
MAX_PRICE_USD=25
DEMO_MODE=true                  # local DemoFacilitator
```

Do **not** set `EVM_PRIVATE_KEY` on Vercel/Render. Buyer keys stay on the operator laptop.

`x402.org/facilitator` is not the default production path for mainnet EVM.

## Run

```bash
cp .env.example .env
pnpm install
pnpm --filter @x402orcle/oracle-brain test
pnpm --filter @x402orcle/mcp test
pnpm --filter @x402orcle/mcp dev     # :4021
pnpm --filter @x402orcle/web dev     # :3000 landing
```

Unpaid consult → HTTP 402 + `PAYMENT-REQUIRED` (base64 JSON, `extensions.bazaar`).  
Demo: `POST /v1/demo/mint-payment` then retry with `PAYMENT-SIGNATURE`.

## Bazaar

Cataloging is **settlement-triggered**. Validate first (no pay):

```bash
curl -sS -X POST https://api.cdp.coinbase.com/platform/v2/x402/validate \
  -H 'content-type: application/json' \
  -d '{"resource":"https://YOUR_HOST/api/consult/oracle_ask","method":"POST"}'
```

Then one mainnet seed settle from a local burner. No settlement = no rank.

## Monorepo

```
apps/web            Next.js App Router landing + discovery + 402
apps/mcp            streamable-HTTP paid MCP + HTTP twins
packages/oracle-brain
```

FOSS: `@x402/mcp` `createPaymentWrapper` + `x402ResourceServer`, `@x402/extensions/bazaar` `declareDiscoveryExtension` (see `apps/mcp/src/x402-foss.ts`).

## Legal

Payment for delivered consult artifacts or a voluntary tip. Not a token, not equity, not a raise.
