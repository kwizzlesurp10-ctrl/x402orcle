# MEMORY.md — x402orcle

## Quick reference
- Canonical: this monorepo (`kwizzlesurp10-ctrl/x402orcle`). Do not create `x402oracle`.
- Slug: x402orcle
- Live: https://x402orcle.vercel.app
- PayTo env: X402_PAY_TO (address only)
- Network: eip155:8453
- Facilitator (mainnet): https://api.cdp.coinbase.com/platform/v2/x402
- Local: DEMO_MODE=true, apps/mcp :4021, apps/web :3000
- Ranking: settlements, not 402s

## Do not
- Put EVM_PRIVATE_KEY on Vercel/Render
- Teach x402.org facilitator as mainnet default
- Resettle frozen Bazaar catalog copy for description changes
