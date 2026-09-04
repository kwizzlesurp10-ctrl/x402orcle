import { envelope, type WisdomEnvelope } from "./envelope.js";
import { getTool, type OracleToolSpec } from "./catalog.js";
import { ORACLE_CONNECT_HOWTO, ORACLE_SYSTEM_PROMPT } from "./persona.js";
import { refuseKeyRequestMessage } from "./policy.js";
import type { OracleEnv } from "./env.js";

const CITATIONS = {
  mcp: "https://github.com/x402-foundation/x402/blob/main/docs/guides/mcp-server-with-x402.md",
  bazaar: "https://docs.cdp.coinbase.com/x402/seller/get-discovered",
  search: "https://docs.cdp.coinbase.com/x402/buyer/discover-services",
  bazaarMcp: "https://docs.cdp.coinbase.com/x402/mcp-server.md",
  next: "https://www.npmjs.com/package/@x402/next",
  validate: "https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/validate-x402-endpoint",
};

function implPrompt(body: string): string {
  return [
    "SYSTEM:",
    ORACLE_SYSTEM_PROMPT,
    "",
    "USER:",
    "Apply the following change with typed env (zod), price caps, no private keys on the seller host, free health+pricing tools, and MAX_PRICE_USD=25.",
    body,
  ].join("\n");
}

export function fallbackConsult(opts: {
  tool: OracleToolSpec;
  env: OracleEnv;
  input: Record<string, unknown>;
  receipt?: WisdomEnvelope["receipt"];
}): WisdomEnvelope {
  const q = JSON.stringify(opts.input).toLowerCase();
  const toolName = opts.tool.name;

  if (toolName === "oracle_diagnose_402") {
    const raw = String(opts.input.challenge_b64_or_json ?? "");
    let parsed: unknown = null;
    try {
      const json = raw.trim().startsWith("{")
        ? raw
        : Buffer.from(raw, "base64").toString("utf8");
      parsed = JSON.parse(json);
    } catch {
      parsed = null;
    }
    const obj = parsed as {
      accepts?: unknown[];
      extensions?: { bazaar?: unknown };
      resource?: { url?: string };
    } | null;
    const hasBazaar = Boolean(obj?.extensions?.bazaar);
    const hasAccepts = Array.isArray(obj?.accepts) && obj.accepts.length > 0;
    const verdict = !obj
      ? "unparseable_challenge"
      : !hasAccepts
        ? "missing_accepts"
        : !hasBazaar
          ? "missing_bazaar_extension"
          : "challenge_shape_ok";
    return envelope({
      verdict,
      wisdom:
        verdict === "challenge_shape_ok"
          ? "PAYMENT-REQUIRED decodes. Next: CDP validate (no pay) then one mainnet settle. Ranking will not move on 402s alone."
          : "A live 402 must be standard base64 JSON with accepts[] (scheme exact, network eip155:8453, Base USDC) and extensions.bazaar.info.input.method. CDP validate fails valid_json when the header is a stub.",
      implementation_prompt: implPrompt(
        `Fix the 402 on ${String(opts.input.resource_url ?? "the paid route")}: emit PAYMENT-REQUIRED as base64 JSON; include declareDiscoveryExtension; resource.url must be the public HTTPS path; do not settle until CDP validate returns valid=true and simulation.outcome=accepted.`,
      ),
      risk: "Indexing a malformed challenge wastes facilitator quota; resettling frozen catalog copy burns USDC.",
      citations: [CITATIONS.validate, CITATIONS.bazaar],
      receipt: opts.receipt,
    });
  }

  if (toolName === "oracle_bazaar_rewrite") {
    const phrases = Array.isArray(opts.input.buyer_phrases)
      ? (opts.input.buyer_phrases as unknown[]).map(String)
      : ["x402 mcp oracle", "paid mcp bazaar", "a2a 402 consult"];
    const serviceName = "x402 MCP Oracle".slice(0, 32);
    const description = [
      phrases[0],
      "Paid MCP consults for x402, Bazaar ranking, A2A tasks, burner isolation.",
      "Free oracle_health + oracle_pricing. Base USDC eip155:8453.",
      "Wisdom envelope with implementation_prompt. No private keys.",
    ]
      .join(" ")
      .slice(0, 500);
    const tags = ["x402", "mcp", "bazaar", "a2a", "oracle"].slice(0, 5);
    return envelope({
      verdict: "rewrite_ready_do_not_resettle_frozen_url",
      wisdom: `serviceName=${serviceName}. Front-load buyer phrases. If this URL is already indexed, CDP catalog text may freeze — ship a new path and seed-settle once. Search uses query= and limit≤20.`,
      implementation_prompt: implPrompt(
        `Set bazaar serviceName to "${serviceName}", description to ${JSON.stringify(description)}, tags ${JSON.stringify(tags)}. Bust challenge cache fingerprint. Do not resettle the old URL hoping copy flips.`,
      ),
      risk: "Price filters hide SKUs above maxUsdPrice. Keep a ≤$0.15 oracle_ask path for agent discovery.",
      citations: [CITATIONS.search, CITATIONS.bazaar],
      receipt: opts.receipt,
      agent: {
        serviceName,
        description,
        tags,
        notes: "first-index freeze possible",
      },
    });
  }

  if (toolName === "oracle_review_mcp") {
    return envelope({
      verdict: "require_wrapper_plus_free_health",
      wisdom:
        "A Bazaar-ready paid MCP server must expose createPaymentWrapper (or equivalent), x402ResourceServer on eip155:8453, declareDiscoveryExtension with toolName, a free health tool, paid consults, and streamable-http at /mcp. Mix free+paid. Seller process must not load EVM_PRIVATE_KEY.",
      implementation_prompt: implPrompt(
        `Review ${String(opts.input.mcp_url ?? "/mcp")}: add oracle_health + oracle_pricing free; wrap paid handlers with createPaymentWrapper; attach bazaar extensions; keep MAX_PRICE_USD gate; document connect how-to without keys.`,
      ),
      risk: "Vercel SSE sessions + in-memory MCP maps fail across isolates — prefer stateless streamable HTTP or a long-lived MCP process.",
      citations: [CITATIONS.mcp, CITATIONS.bazaarMcp],
      receipt: opts.receipt,
    });
  }

  if (toolName === "complete_oracle_task") {
    return envelope({
      verdict: "outcome_path_seed_settle",
      wisdom:
        "Outcome task: deploy HTTPS → GET 402 crawler on every paid POST → CDP validate → one seed settle from a local burner with USDC on Base → confirm discovery/search. Heartbeat settlements only where external demand exists.",
      implementation_prompt: implPrompt(
        String(opts.input.goal ?? "Ship first Bazaar-listed paid consult") +
          "\nConstraints: " +
          String(opts.input.constraints ?? "seller-only, no spend key on host") +
          "\nDeliver typed diffs, Playwright checks for 402 + llms.txt + JSON-LD, and do not hard-code keys.",
      ),
      risk: "Operator self-settles are not external revenue. Score sales_external separately.",
      citations: [CITATIONS.bazaar, CITATIONS.validate],
      receipt: opts.receipt,
    });
  }

  const rankTalk = /rank|bazaar|catalog|settlement/.test(q);
  return envelope({
    verdict: rankTalk ? "no_mainnet_settlement_no_rank" : "protocol_current",
    wisdom: rankTalk
      ? "Bazaar ranking is settlement-driven (l30DaysTotalCalls, unique payers, lastCalledAt, schema completeness). Embedding extensions.bazaar is necessary but not sufficient. Validate first (no pay), then settle once on the public HTTPS URL."
      : [
          "Use @x402/mcp createPaymentWrapper + x402ResourceServer (ExactEvmScheme).",
          "HTTP twins: paymentMiddleware / withX402 so crawlers hit GET 402.",
          "Facilitator for Base mainnet: CDP, not x402.org.",
          "Discovery files: /.well-known/x402, mcp.json, agent-card.json, funding.json, /llms.txt, /agents.txt, openapi x-payment-info.",
          refuseKeyRequestMessage(),
          "Connect:\n" + ORACLE_CONNECT_HOWTO,
        ].join(" "),
    implementation_prompt: implPrompt(
      String(opts.input.question ?? opts.input.goal ?? "Answer the agent's x402 question with exact typed diffs and no leaked keys."),
    ),
    risk: "Stale snippets that still show Base Sepolia + x402.org as production will fail mainnet settle and never rank.",
    citations: [CITATIONS.mcp, CITATIONS.bazaar, CITATIONS.next, CITATIONS.bazaarMcp],
    receipt: opts.receipt,
  });
}

export async function maybeLlmConsult(opts: {
  tool: OracleToolSpec;
  env: OracleEnv;
  input: Record<string, unknown>;
  receipt?: WisdomEnvelope["receipt"];
}): Promise<WisdomEnvelope> {
  const fallback = fallbackConsult(opts);
  if (!opts.env.llmApiKey) return fallback;
  try {
    const res = await fetch(`${opts.env.llmBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${opts.env.llmApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: opts.env.llmModel,
        temperature: 0.2,
        messages: [
          { role: "system", content: ORACLE_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Tool=${opts.tool.name}\nInput=${JSON.stringify(opts.input)}\nReturn JSON {verdict,wisdom,implementation_prompt,risk,citations:string[]}`,
          },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd < 0) return fallback;
    const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1)) as {
      verdict?: string;
      wisdom?: string;
      implementation_prompt?: string;
      risk?: string;
      citations?: string[];
    };
    return envelope({
      verdict: parsed.verdict || fallback.verdict,
      wisdom: parsed.wisdom || fallback.wisdom,
      implementation_prompt: parsed.implementation_prompt || fallback.implementation_prompt,
      risk: parsed.risk || fallback.risk,
      citations: parsed.citations?.length ? parsed.citations : fallback.citations,
      receipt: opts.receipt,
    });
  } catch {
    return fallback;
  }
}

export function requireTool(name: string): OracleToolSpec {
  const t = getTool(name);
  if (!t) throw new Error(`UNKNOWN_TOOL:${name}`);
  return t;
}
