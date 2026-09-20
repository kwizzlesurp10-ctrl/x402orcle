# 🛰️ x402 Oracle (`x402orcle`)

> **"402 is the answer. The Oracle is how you ask."**  
> First-principles autonomous blockchain oracle and consultative wisdom market powered by HTTP 402 micro-settlements on **Base USDC (`eip155:8453`)**.

[![Build Status](https://img.shields.io/badge/build-passing-00ff9d.svg)](#)
[![Network](https://img.shields.io/badge/network-Base%20Mainnet%20(8453)-00f0ff.svg)](https://basescan.org)
[![Protocol](https://img.shields.io/badge/protocol-x402%20v2-ffb700.svg)](https://github.com/x402-foundation/x402)
[![Settlement](https://img.shields.io/badge/settlement-EIP--712%20%2F%20EIP--3009-00ff9d.svg)](#)
[![MCP](https://img.shields.io/badge/mcp-streamable--http-00f0ff.svg)](/mcp)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 🚀 Mission Architecture & First Principles

1. **Zero Spend Keys on Host**: The seller host holds **0 private keys**. Attack surface is mathematically eliminated. Receiver address is public vault `0x05e1720bB82F86B5bc7940a99FDC702E32256357`.
2. **Deterministic 402/200 Cycle**: Unpaid probes receive RFC HTTP 402 + Base64 `PAYMENT-REQUIRED` challenge headers. Signed EIP-712 envelopes settle gaslessly and return verifiable Wisdom Envelopes.
3. **Sub-Millisecond Telemetry**: Real-time round-trip latency tracking (P99 < 25ms), continuous health checks, and live CDP facilitator verification.
4. **Autonomous Machine Discovery**: Complete native support for MCP (Model Context Protocol), Google Agent-to-Agent (A2A), xAI Grok, OpenAPI 3.1, and LLMs.txt.

---

## 🌐 Discovery & Machine Surface Index

| Surface | Endpoint Path | Description |
| :--- | :--- | :--- |
| **Mission Control & Web App** | `/` | Real-time telemetry HUD, Interactive Sandbox, Signature Inspector, Web CLI |
| **Interactive API Specs** | `/docs` | Hosted Scalar API Reference documentation linked to OpenAPI 3.1 |
| **x402 Protocol Manifest** | `/.well-known/x402` | Canonical machine-readable x402 v2 payment catalog & resource parameters |
| **Streamable MCP Gateway** | `/mcp` | Model Context Protocol JSON-RPC 2.0 streamable-HTTP RPC gateway |
| **MCP Manifest** | `/.well-known/mcp.json` | MCP tools manifest & capability definitions |
| **A2A Agent Card** | `/.well-known/agent-card.json` | Google Agent-to-Agent (A2A) protocol specification |
| **Funding & PayTo Manifest** | `/.well-known/funding.json` | Canonical onchain receiver address and Base USDC settlement configuration |
| **OpenAPI 3.1 Spec** | `/openapi.json` | Complete REST schema with `x-payment-info` extensions |
| **LLMs Minimal Reference** | `/llms.txt` | Compact machine discovery context for LLMs & autonomous agents |
| **LLMs Full Reference** | `/llms-full.txt` | Complete TypeScript interfaces, envelope schemas, and technical specs |
| **Agents Permissions** | `/agents.txt` | Web crawler and AI agent permissions matrix |
| **JSON-LD Schema Graph** | `/jsonld` | Schema.org semantic WebAPI & SoftwareApplication graph |
| **Health Telemetry** | `/api/health` | Live operational status, timestamp, and network posture |
| **Pricing Menu** | `/api/pricing` | Free and paid capabilities menu with connection guides |
| **Revenue ledger** | `/ledger/revenue` | Settled sales (external vs operator attribution) — parity with x402-mcp |
| **Storefront revenue** | `/swarm/revenue` | Aggregated USDC totals by product |
| **Demand funnel** | `/demand` | 402 challenges vs settled sales |
| **Wallet** | `/wallet` | Public receive address + retired-payTo warning |

---

## ⚡ Capability Matrix & Pricing

| Capability | Tier | Price (USDC) | Method | Endpoint | Output Artifact |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `oracle_health` | **Free** | `$0.00` | `GET` | `/api/health` | Liveness & key safety posture |
| `oracle_pricing` | **Free** | `$0.00` | `GET` | `/api/pricing` | Menu of paid consults & connection instructions |
| `oracle_ask` | **Paid** | `$0.10` | `POST` | `/api/consult/oracle_ask` | Expert wisdom envelope, citations, receipt |
| `oracle_diagnose_402` | **Paid** | `$0.50` | `POST` | `/api/consult/oracle_diagnose_402` | Post-mortem 402 challenge shape analysis |
| `oracle_review_mcp` | **Paid** | `$3.00` | `POST` | `/api/consult/oracle_review_mcp` | MCP paid-tool server architectural audit |
| `oracle_bazaar_rewrite` | **Paid** | `$1.50` | `POST` | `/api/consult/oracle_bazaar_rewrite` | Buyer-query rank rewrite & freeze warnings |
| `complete_oracle_task` | **Paid** | `$10.00` | `POST` | `/api/consult/complete_oracle_task` | Outcome-driven typed diffs & builder prompt |

*Note: All prices are strictly capped by `MAX_PRICE_USD=25`.*

---

## 🔐 Cryptographic Handshake ($SIG & EIP-712)

### EIP-712 Domain Specification (Base Mainnet)
```json
{
  "name": "USD Coin",
  "version": "2",
  "chainId": 8453,
  "verifyingContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
}
```

### EIP-3009 TransferWithAuthorization Primary Type
```json
{
  "TransferWithAuthorization": [
    { "name": "from", "type": "address" },
    { "name": "to", "type": "address" },
    { "name": "value", "type": "uint256" },
    { "name": "validAfter", "type": "uint256" },
    { "name": "validBefore", "type": "uint256" },
    { "name": "nonce", "type": "bytes32" }
  ]
}
```

### Outer Payment Signature Header Envelope
```json
{
  "x402Version": 2,
  "accepted": {
    "scheme": "exact",
    "network": "eip155:8453",
    "amount": "100000",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0x05e1720bB82F86B5bc7940a99FDC702E32256357"
  },
  "payload": {
    "signature": "0x...",
    "authorization": {
      "from": "0xPayerWalletAddress",
      "to": "0x05e1720bB82F86B5bc7940a99FDC702E32256357",
      "value": "100000",
      "validAfter": "0",
      "validBefore": "1770000000",
      "nonce": "0x..."
    }
  }
}
```
*Encode as base64 and attach to HTTP header:* `PAYMENT-SIGNATURE: <base64_payload>`.

---

## 🛠️ Quickstart & Local Development

### 1. Environment Configuration
```bash
cp .env.example .env
```

```ini
# Environment variables (NEVER place spend keys on the host)
X402_PAY_TO=0x05e1720bB82F86B5bc7940a99FDC702E32256357
X402_NETWORK=eip155:8453
X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
CDP_API_KEY_ID=                     # CDP API Key ID for JWT auth (Not a wallet key)
CDP_API_KEY_SECRET=                 # CDP API Secret
MAX_PRICE_USD=25
DEMO_MODE=true                      # Enables local DemoFacilitator simulation
SWARM_PUBLIC_URL=                   # Optional discovery link; Oracle never calls or pays it internally
```

### 2. Install & Run
```bash
# Install dependencies
pnpm install

# Run all test suites (oracle-brain & mcp)
pnpm test

# Run Next.js Web App (:3001)
pnpm --filter @x402orcle/web dev

# Run Streamable MCP Server (:4021)
pnpm --filter @x402orcle/mcp dev
```

---

## 🤖 Model Context Protocol (MCP) Mounting

### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "x402oracle": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch", "https://x402orcle.vercel.app/mcp"],
      "env": {
        "X402_NETWORK": "eip155:8453"
      }
    }
  }
}
```

### Cursor IDE (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "x402oracle": {
      "url": "https://x402orcle.vercel.app/mcp",
      "type": "streamable-http",
      "headers": {
        "x402-version": "2"
      }
    }
  }
}
```

---

## 📦 Monorepo Architecture

```
x402orcle/
├── apps/
│   ├── web/                     # Next.js 15 App Router landing, Mission Control, Sandbox, Docs
│   │   ├── app/
│   │   │   ├── components/      # HUD Telemetry, Sandbox, CLI Terminal, Validator Workbench
│   │   │   ├── docs/            # Hosted Scalar API Reference (/docs)
│   │   │   ├── api/consult/     # 402 / 200 HTTP consult endpoints
│   │   │   ├── api/health/      # Real-time liveness telemetry
│   │   │   └── mcp/             # Streamable HTTP MCP endpoint
│   └── mcp/                     # Express MCP Streamable HTTP JSON-RPC service
└── packages/
    └── oracle-brain/            # Core cryptographic policy, validator, catalog, and envelope engine
        ├── src/validator.ts     # Real-time EIP-712 signature verification engine
        ├── src/challenge.ts     # 402 challenge construction & Base64 encoders
        ├── src/http.ts          # Deterministic 402/200 HTTP consult handler
        └── src/catalog.ts       # Capability schemas & tool definitions
```

---

## ⚖️ Legal & Disclaimer

Payment is strictly for delivered consultative compute artifacts and attestation receipts. Not a token, not equity, not a fundraising instrument.
