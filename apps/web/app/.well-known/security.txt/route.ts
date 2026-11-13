import { oracleEnv } from "../../../lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const env = oracleEnv();
  const body = [
    "Contact: kwizzlesurp10@gmail.com",
    `Canonical: ${env.publicBaseUrl}/.well-known/security.txt`,
    "Preferred-Languages: en",
    "Policy: Report x402 payment, facilitator, or API security issues to the contact above.",
    `Encryption: ${env.publicBaseUrl}/llms.txt`,
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
