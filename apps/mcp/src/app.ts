import express, { type Express, type Request, type Response } from "express";
import {
  type OracleEnv,
  TOOLS,
  PAID_TOOLS,
  FREE_TOOLS,
  SERVICE,
  clampPrice,
  requireTool,
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
  agentsTxt,
  openApi,
  jsonLd,
  landingHtml,
  ORACLE_CONNECT_HOWTO,
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
}): Promise<{ status: number; headers?: Record<string, string>; body: unknown }> {
  return handleConsult(opts);
}

export function createOracleApp(env: OracleEnv): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

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
  app.get("/agents.txt", (_req, res) => {
    res.type("text/plain").send(agentsTxt(env));
  });
  app.get("/openapi.json", (_req, res) => res.json(openApi(env)));
  app.get("/jsonld", (_req, res) => res.json(jsonLd(env)));

  app.post("/v1/demo/mint-payment", (req, res) => {
    if (!env.demoMode) {
      res.status(403).json({ code: "DEMO_DISABLED" });
      return;
    }
    const toolName =
      typeof req.body?.tool === "string" ? req.body.tool : "oracle_ask";
    const tool = requireTool(toolName);
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
    const input = (req.method === "GET" ? (req.query as Record<string, unknown>) : (req.body ?? {})) as Record<
      string,
      unknown
    >;
    const result = await runPaid({
      env,
      toolName,
      input,
      payment: paymentFromReq(req),
      transport: "http",
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
            inputSchema: { type: "object", properties: {}, additionalProperties: true },
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
