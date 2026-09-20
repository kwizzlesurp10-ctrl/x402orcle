import express, { type Express, type Request, type Response } from "express";
import {
  type OracleEnv,
  TOOLS,
  PAID_TOOLS,
  FREE_TOOLS,
  SERVICE,
  clampPrice,
  decodePaymentHeader,
  buildDemoPaymentPayload,
  buildPaymentRequired,
  demoPayerFromPayload,
  handleConsult,
  funding,
  wellKnownX402,
  mcpJson,
  agentCard,
  agentsJson,
  llmsTxt,
  llmsFullTxt,
  agentsTxt,
  openApi,
  jsonLd,
  landingHtml,
  ORACLE_CONNECT_HOWTO,
  getTool,
  readRevenue,
  revenueSummary,
  demandSnapshot,
  DEFAULT_PAY_TO,
} from "@x402orcle/oracle-brain";

function paymentFromReq(req: Request): unknown | null {
  const header =
    (req.header("PAYMENT-SIGNATURE") ||
      req.header("payment-signature") ||
      req.header("X-PAYMENT") ||
      "") as string;
  if (header) return decodePaymentHeader(header);
  const body = req.body as { payment?: unknown } | undefined;
  return body?.payment ?? null;
}

async function runPaid(opts: {
  env: OracleEnv;
  toolName: string;
  input: Record<string, unknown>;
  payment: unknown | null;
  transport: "http" | "mcp";
  execution?: "challenge" | "execute";
}): Promise<{ status: number; headers?: Record<string, string>; body: unknown }> {
  return handleConsult(opts);
}

export function createOracleApp(env: OracleEnv): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use((error: unknown, _req: Request, res: Response, next: (error?: unknown) => void) => {
    if (error instanceof SyntaxError) {
      res.status(400).json({ code: "INVALID_REQUEST", message: "Request body must be valid JSON" });
      return;
    }
    next(error);
  });

  app.get("/", (_req, res) => {
    res.type("html").send(landingHtml(env));
  });

  const healthBody = {
    ok: true,
    service: SERVICE.name,
    slug: SERVICE.slug,
    version: SERVICE.version,
    network: env.network,
    pay_to_configured: Boolean(env.payTo),
    pay_to: env.payTo,
    pay_to_matches_default: env.payTo.toLowerCase() === DEFAULT_PAY_TO.toLowerCase(),
    pay_to_retired_warning: env.payToRetiredWarning,
    cdp_auth_configured: Boolean(env.cdpApiKeyId && env.cdpApiKeySecret),
    wallet_configured: false,
    seller_leak_warning: env.sellerLeakWarning,
    demoMode: env.demoMode,
    facilitator: env.demoMode ? "demo://local" : env.facilitatorUrl,
    maxPriceUsd: env.maxPriceUsd,
    thesis: SERVICE.thesis,
  };
  app.get("/health", (_req, res) => {
    res.json(healthBody);
  });
  app.get("/api/health", (_req, res) => {
    res.json(healthBody);
  });

  app.get("/api/pricing", (_req, res) => {
    res.json({
      maxPriceUsd: env.maxPriceUsd,
      network: env.network,
      payTo: env.payTo,
      connect: ORACLE_CONNECT_HOWTO,
      free: FREE_TOOLS.map((t) => ({ name: t.name, path: t.httpPath })),
      paid: PAID_TOOLS.map((t) => ({
        name: t.name,
        path: t.httpPath,
        method: t.httpMethod,
        priceUsd: clampPrice(t, undefined, env.maxPriceUsd),
      })),
    });
  });

  app.get("/.well-known/x402", (_req, res) => res.json(wellKnownX402(env)));
  app.get("/.well-known/mcp.json", (_req, res) => res.json(mcpJson(env)));
  app.get("/.well-known/mcp", (_req, res) => res.json(mcpJson(env)));
  app.get("/.well-known/agent-card.json", (_req, res) => res.json(agentCard(env)));
  app.get("/.well-known/agents.json", (_req, res) => res.json(agentsJson(env)));
  app.get("/.well-known/funding.json", (_req, res) => res.json(funding(env)));
  app.get("/llms.txt", (_req, res) => {
    res.type("text/plain").send(llmsTxt(env));
  });
  app.get("/llms-full.txt", (_req, res) => {
    res.type("text/plain").send(llmsFullTxt(env));
  });
  app.get("/agents.txt", (_req, res) => {
    res.type("text/plain").send(agentsTxt(env));
  });
  app.get("/openapi.json", (_req, res) => res.json(openApi(env)));
  app.get("/docs", (_req, res) => {
    res.type("html").send(`<!DOCTYPE html>
<html>
<head>
  <title>${SERVICE.name} - API Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@scalar/api-reference/dist/style.min.css">
</head>
<body style="margin: 0; background: #0b0f17;">
  <script id="api-reference" data-url="/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`);
  });
  app.get("/jsonld", (_req, res) => res.json(jsonLd(env)));

  app.get("/ledger/revenue", (req, res) => {
    const limitRaw = Number(req.query.limit ?? 1000);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 5000) : 1000;
    const rows = readRevenue(limit);
    res.json(rows);
  });

  app.get("/swarm/revenue", (_req, res) => {
    const summary = revenueSummary();
    res.json({
      scope: "oracle_storefront",
      note: "Settled oracle consult revenue. Operator self-settles are not external demand.",
      ...summary,
      storefront: summary,
    });
  });

  app.get("/demand", (_req, res) => {
    res.json(demandSnapshot());
  });

  app.get("/wallet", (_req, res) => {
    res.json({
      receive_address: env.payTo,
      default_pay_to: DEFAULT_PAY_TO,
      pay_to_retired_warning: env.payToRetiredWarning,
      network: env.network,
      note: "Private keys stay in server env; this endpoint never returns key material.",
    });
  });

  app.post("/v1/demo/mint-payment", (req, res) => {
    if (!env.demoMode) {
      res.status(403).json({ code: "DEMO_DISABLED" });
      return;
    }
    const toolName =
      typeof req.body?.tool === "string" ? req.body.tool : "oracle_ask";
    const tool = getTool(toolName);
    if (!tool || tool.tier !== "paid") {
      res.status(404).json({ code: "TOOL_NOT_FOUND", message: `Unknown paid tool: ${toolName}` });
      return;
    }
    const priceUsd = clampPrice(tool, undefined, env.maxPriceUsd);
    const pr = buildPaymentRequired({ env, tool, priceUsd });
    const payload = buildDemoPaymentPayload({
      accepts: pr.accepts[0]!,
      payer: typeof req.body?.payer === "string" ? req.body.payer : undefined,
      resourceUrl: pr.resource.url,
    });
    res.json({
      meta_key: "x402/payment",
      payment: payload,
      payment_signature_header: Buffer.from(JSON.stringify(payload)).toString("base64"),
      payer: demoPayerFromPayload(payload),
    });
  });

  const consultHandler = async (req: Request, res: Response) => {
    const toolName = String(req.params.tool || "");
    const input = req.method === "GET" ? {} : { ...((req.body ?? {}) as Record<string, unknown>) };
    delete input.payment;
    const result = await runPaid({
      env,
      toolName,
      input,
      payment: paymentFromReq(req),
      transport: "http",
      execution: req.method === "GET" ? "challenge" : "execute",
    });
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
    }
    res.status(result.status).json(result.body);
  };

  app.get("/api/consult/:tool", consultHandler);
  app.post("/api/consult/:tool", consultHandler);

  app.post("/mcp", async (req, res) => {
    const body = req.body as {
      jsonrpc?: string;
      id?: unknown;
      method?: string;
      params?: {
        name?: string;
        arguments?: Record<string, unknown>;
        _meta?: Record<string, unknown>;
      };
    };
    const id = body.id ?? null;
    if (body.method === "initialize") {
      res.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-03-26",
          serverInfo: { name: SERVICE.slug, version: SERVICE.version },
          capabilities: { tools: {} },
        },
      });
      return;
    }
    if (body.method === "tools/list" || body.method === "notifications/initialized") {
      if (body.method === "notifications/initialized") {
        res.status(202).end();
        return;
      }
      res.json({
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        },
      });
      return;
    }
    if (body.method === "tools/call") {
      const name = body.params?.name ?? "";
      const args = body.params?.arguments ?? {};
      const payment = body.params?._meta?.["x402/payment"] ?? null;
      if (name === "oracle_health") {
        res.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify({ ok: true, wallet_configured: false }) }],
          },
        });
        return;
      }
      if (name === "oracle_pricing") {
        res.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  paid: PAID_TOOLS.map((t) => t.name),
                  connect: ORACLE_CONNECT_HOWTO,
                }),
              },
            ],
          },
        });
        return;
      }
      const result = await runPaid({
        env,
        toolName: name,
        input: args,
        payment,
        transport: "mcp",
      });
      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value);
      }
      if (result.status === 402) {
        res.json({
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            structuredContent: result.body,
            content: [{ type: "text", text: JSON.stringify(result.body) }],
          },
        });
        return;
      }
      if (result.status !== 200) {
        res.json({
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            structuredContent: result.body,
            content: [{ type: "text", text: JSON.stringify(result.body) }],
          },
        });
        return;
      }
      res.json({
        jsonrpc: "2.0",
        id,
        result: {
          structuredContent: result.body,
          content: [{ type: "text", text: JSON.stringify(result.body) }],
        },
      });
      return;
    }
    res.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Unknown method ${body.method}` },
    });
  });

  return app;
}

export { runPaid };
