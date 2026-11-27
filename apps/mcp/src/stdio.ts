import { createInterface } from "node:readline";
import {
  SERVICE,
  getTool,
  handleConsult,
  loadEnv,
  mcpToolDefinitions,
} from "@x402orcle/oracle-brain";

const env = loadEnv({
  ...process.env,
  X402_PAY_TO:
    process.env.X402_PAY_TO ||
    process.env.X402_PAY_TO_ADDRESS ||
    "0x0d25A44f74868eCE53B305C97139CF4B62963410",
  DEMO_MODE: process.env.DEMO_MODE ?? "true",
});

function writeJson(msg: unknown) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

async function handleRequest(line: string) {
  let req: {
    jsonrpc?: string;
    id?: unknown;
    method?: string;
    params?: {
      name?: string;
      arguments?: Record<string, unknown>;
      _meta?: Record<string, unknown>;
    };
  };
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }

  const id = req.id;
  if (req.method === "notifications/initialized" || id === undefined) {
    return;
  }

  if (req.method === "initialize") {
    writeJson({
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

  if (req.method === "tools/list") {
    writeJson({
      jsonrpc: "2.0",
      id,
      result: {
        tools: mcpToolDefinitions(),
      },
    });
    return;
  }

  if (req.method === "tools/call") {
    const name = req.params?.name ?? "";
    const args = req.params?.arguments ?? {};
    const payment = req.params?._meta?.["x402/payment"] ?? null;
    if (!getTool(name)) {
      writeJson({
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [{ type: "text", text: `UNKNOWN_TOOL:${name}` }],
        },
      });
      return;
    }
    try {
      const res = await handleConsult({
        env,
        toolName: name,
        input: args,
        payment,
        transport: "mcp",
      });
      writeJson({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(res.body) }],
          ...(res.status >= 400 ? { isError: true } : {}),
        },
      });
    } catch (err) {
      writeJson({
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [{ type: "text", text: String(err) }],
        },
      });
    }
    return;
  }

  writeJson({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${req.method}` },
  });
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (trimmed) {
    void handleRequest(trimmed);
  }
});
