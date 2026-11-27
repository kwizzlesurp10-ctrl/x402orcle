import { oracleEnv } from "../../../lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const env = oracleEnv();
  const body = [
    "# Kwizzlesurp x402 Security & Payee Verification (RFC 9116)",
    "Contact: mailto:kwizzlesurp10@gmail.com",
    `Canonical: ${env.publicBaseUrl}/.well-known/security.txt`,
    "Preferred-Languages: en",
    `Policy: ${env.publicBaseUrl}`,
    `Acknowledgments: ${env.publicBaseUrl}/.well-known/x402`,
    "",
    "# Canonical Settlement Authority",
    `Canonical-Payee: ${env.payTo}`,
    "Payee-Type: Coinbase Base Account (EIP-55 EVM)",
    "Supported-Networks: eip155:8453 (Base Mainnet)",
    "Accepted-Asset: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (USDC on Base)",
    `Attestation: ${env.publicBaseUrl}/.well-known/payee-attestation.json`,
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
