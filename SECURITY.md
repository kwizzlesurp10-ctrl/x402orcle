# Security

- Seller public hosts: `X402_PAY_TO` (address) + facilitator URL only.
- Never commit `.env`, private keys, or 66-char hex.
- `EVM_PRIVATE_KEY` on this process is a leak warning (`seller_leak_warning`).
- Oracle tools refuse key-shaped input and never solicit secrets.
- `MAX_PRICE_USD` gates every paid tool.
- Demo facilitator is local-only (`DEMO_MODE=true`).
