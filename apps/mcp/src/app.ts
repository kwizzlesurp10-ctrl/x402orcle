import express, { type Express, type Request, type Response } from "express";
import {
  type OracleEnv,
  TOOLS,
  PAID_TOOLS,
  FREE_TOOLS,
  SERVICE,
  clampPrice,
  getTool,
  requireTool,
  parsePaymentHeader,
  allowHeader,
  methodNotAllowedBody,
  buildDemoPaymentPayload,
  buildPaymentRequired,
  demoPayerFromPayload,
  handleConsult,
  handleA2aJsonRpc,
  isPaidConsultTool,
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
  jsonSchemaFromExample,
} from "@x402orcle/oracle-brain";

function paymentFromReq(req: Request): {
  payment: unknown | null;
  paymentHeaderInvalid: boolean;
} {
  const header =
    (req.header("PAYMENT-SIGNATURE") ||
      req.header("payment-signature") ||
      req.header("X-PAYMENT") ||
      "") as string;
  const parsed = parsePaymentHeader(header);
  if (parsed.kind === "present") {
    return { payment: parsed.payment, paymentHeaderInvalid: false };
  }
  if (parsed.kind === "invalid") {
    return { payment: null, paymentHeaderInvalid: true };
  }
  const body = req.body as { payment?: unknown } | undefined;
  return { payment: body?.payment ?? null, paymentHeaderInvalid: false };
}

async function runPaid(opts: {
  env: OracleEnv;
  toolName: string;
  input: Record<string, unknown>;
  payment: unknown | null;
  paymentHeaderInvalid?: boolean;
  transport: "http" | "mcp";
}): Promise<{ status: number; headers?: Record<string, string>; body: unknown }> {
  return handleConsult(opts);
}

function mcpHealthBody(env: OracleEnv) {
  return {
    ok: true,
    service: SERVICE.name,
    slug: SERVICE.slug,
    version: SERVICE.version,
    wallet_configured: false,
    pay_to_configured: Boolean(env.payTo),
    cdp_auth_configured: Boolean(env.cdpApiKeyId && env.cdpApiKeySecret),
    seller_leak_warning: env.sellerLeakWarning,
    demoMode: env.demoMode,
    network: env.network,
    thesis: SERVICE.thesis,
  };
}

function mcpPricingBody(env: OracleEnv) {
  return {
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
  };
}

function mcpToolResult(id: unknown, body: unknown) {
  return {
    jsonrpc: "2.0" as const,
    id,
    result: {
      structuredContent: body,
      content: [{ type: "text" as const, text: JSON.stringify(body) }],
    },
  };
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
    res.json(mcpPricingBody(env));
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
  app.get("/jsonld", (_req, res) => res.json(jsonLd(env)));

  app.get("/v1/demo/mint-payment", (_req, res) => {
    res.set(allowHeader("POST, OPTIONS"));
    res.status(405).json(methodNotAllowedBody("POST, OPTIONS"));
  });

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
    const { payment, paymentHeaderInvalid } = paymentFromReq(req);
    const input =
      isPaidConsultTool(toolName) && !payment && !paymentHeaderInvalid
        ? ({} as Record<string, unknown>)
        : ((req.method === "GET"
            ? (req.query as Record<string, unknown>)
            : (req.body ?? {})) as Record<string, unknown>);
    const result = await runPaid({
      env,
      toolName,
      input,
      payment,
      paymentHeaderInvalid,
      transport: "http",
    });
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
    }
    res.status(result.status).json(result.body);
  };

  app.get("/api/consult/:tool", consultHandler);
  app.post("/api/consult/:tool", consultHandler);

  app.get("/a2a", (_req, res) => {
    res.set(allowHeader("POST, OPTIONS"));
    res.status(405).json(methodNotAllowedBody("POST, OPTIONS"));
  });

  app.options("/a2a", (_req, res) => {
    res.set({
      ...allowHeader("POST, OPTIONS"),
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, authorization",
    });
    res.status(204).end();
  });

  app.post("/a2a", async (req, res) => {
    const result = await handleA2aJsonRpc({
      env,
      body: req.body as {
        jsonrpc?: string;
        id?: unknown;
        method?: string;
        params?: Record<string, unknown>;
      },
    });
    res.status(result.status).json(result.body);
  });

  app.get("/mcp", (req, res) => {
    const accept = String(req.header("accept") ?? "");
    if (accept.toLowerCase().includes("text/event-stream")) {
      res.set({ ...allowHeader("POST, OPTIONS"), Vary: "Accept" });
      res.status(405).json(methodNotAllowedBody("POST, OPTIONS"));
      return;
    }
    res.set({ Vary: "Accept", "cache-control": "public, max-age=3600, stale-while-revalidate=86400" });
    res.json({
      ...mcpJson(env),
      transport: "streamable-http",
      endpoint: `${env.publicBaseUrl}/mcp`,
      methods_supported: ["initialize", "tools/list", "tools/call", "notifications/initialized"],
      usage:
        "Send HTTP POST with JSON-RPC 2.0 payload to this endpoint. GET returns this catalog (not Server-Sent Events).",
      documentation: `${env.publicBaseUrl}/llms.txt`,
    });
  });

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
            inputSchema: jsonSchemaFromExample(t.inputExample),
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
        res.json(mcpToolResult(id, mcpHealthBody(env)));
        return;
      }
      if (name === "oracle_pricing") {
        res.json(mcpToolResult(id, mcpPricingBody(env)));
        return;
      }
      if (!getTool(name)) {
        res.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: `UNKNOWN_TOOL:${name}` },
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
