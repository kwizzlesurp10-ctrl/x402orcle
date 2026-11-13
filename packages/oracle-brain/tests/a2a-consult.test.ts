import { describe, expect, it, beforeEach } from "vitest";
import {
  loadEnv,
  handleConsult,
  handleA2aJsonRpc,
  getA2aTask,
  clearA2aTasksForTests,
  agentCard,
  a2aEndpointUrl,
  PAID_TOOLS,
} from "../src/index.js";

const env = loadEnv({
  X402_PAY_TO: "0x0d25A44f74868eCE53B305C97139CF4B62963410",
  X402_NETWORK: "eip155:8453",
  DEMO_MODE: "true",
  PUBLIC_BASE_URL: "http://127.0.0.1:4021",
  MAX_PRICE_USD: "25",
});

beforeEach(() => {
  clearA2aTasksForTests();
});

describe("invalid payment signature", () => {
  it("returns 402 with INVALID_PAYMENT_SIGNATURE when header is malformed", async () => {
    const res = await handleConsult({
      env,
      toolName: "oracle_ask",
      input: { question: "hi" },
      payment: null,
      paymentHeaderInvalid: true,
      transport: "http",
    });
    expect(res.status).toBe(402);
    const body = res.body as { error: string; accepts: unknown[] };
    expect(body.error).toBe("INVALID_PAYMENT_SIGNATURE");
    expect(body.accepts.length).toBeGreaterThan(0);
    expect(res.headers?.["PAYMENT-REQUIRED"]).toBeTruthy();
  });
});

describe("consult 402 before validation", () => {
  for (const tool of PAID_TOOLS) {
    it(`${tool.name} returns 402 on empty input without payment`, async () => {
      const res = await handleConsult({
        env,
        toolName: tool.name,
        input: {},
        payment: null,
        transport: "http",
      });
      expect(res.status).toBe(402);
      const headers = res.headers ?? {};
      expect(headers["PAYMENT-REQUIRED"]).toBeTruthy();
      const body = res.body as {
        x402Version: number;
        extensions: { bazaar: { info: { input: { method?: string } } } };
      };
      expect(body.x402Version).toBe(2);
      expect(body.extensions.bazaar.info.input.method).toBe("POST");
    });
  }

  it("rejects invalid input after payment without settling", async () => {
    const verifyCalls: string[] = [];
    const settleCalls: string[] = [];
    const live = loadEnv({
      X402_PAY_TO: "0x0d25A44f74868eCE53B305C97139CF4B62963410",
      PUBLIC_BASE_URL: "https://x402orcle.vercel.app",
      DEMO_MODE: "false",
    });
    const fetchImpl = (async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/verify")) {
        verifyCalls.push(u);
        return new Response(JSON.stringify({ isValid: true, payer: "0xabc" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      settleCalls.push(u);
      return new Response(JSON.stringify({ success: true, transaction: "0x1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const res = await handleConsult({
      env: live,
      toolName: "oracle_ask",
      input: {},
      payment: { x402Version: 2 },
      transport: "http",
      fetchImpl,
    });
    expect(res.status).toBe(400);
    expect(verifyCalls.length).toBe(1);
    expect(settleCalls.length).toBe(0);
  });
});

describe("free consult payloads", () => {
  it("oracle_health returns seller posture with payment null", async () => {
    const res = await handleConsult({
      env,
      toolName: "oracle_health",
      input: {},
      payment: null,
      transport: "http",
    });
    expect(res.status).toBe(200);
    const body = res.body as {
      ok: boolean;
      pay_to_configured: boolean;
      network: string;
      wallet_configured: boolean;
      seller_leak_warning: boolean;
    };
    expect(body.ok).toBe(true);
    expect(body.pay_to_configured).toBe(true);
    expect(body.network).toBe("eip155:8453");
    expect(body.wallet_configured).toBe(false);
    expect(body.seller_leak_warning).toBe(false);
  });

  it("oracle_pricing lists paid oracle_ask at 0.1", async () => {
    const res = await handleConsult({
      env,
      toolName: "oracle_pricing",
      input: {},
      payment: null,
      transport: "http",
    });
    expect(res.status).toBe(200);
    const body = res.body as { paid: Array<{ name: string; priceUsd: number }> };
    expect(body.paid.find((t) => t.name === "oracle_ask")?.priceUsd).toBe(0.1);
  });
});

describe("a2a json-rpc", () => {
  it("empty body returns HTTP 400 Invalid Request", async () => {
    const res = await handleA2aJsonRpc({ env, body: {} });
    expect(res.status).toBe(400);
    const body = res.body as { error: { code: number } };
    expect(body.error.code).toBe(-32600);
  });

  it("message/send unpaid returns input-required task with x402 metadata", async () => {
    const res = await handleA2aJsonRpc({
      env,
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "message/send",
        params: {
          message: {
            role: "user",
            parts: [{ kind: "text", text: "rank?" }],
            metadata: { skillId: "oracle_ask", input: { question: "Why no rank?" } },
          },
        },
      },
    });
    const payload = res.body as { result: { status: { state: string; message: { metadata: Record<string, unknown> } } } };
    expect(payload.result.status.state).toBe("input-required");
    expect(payload.result.status.message.metadata["x402.payment.status"]).toBe("payment-required");
    expect(payload.result.status.message.metadata["x402.payment.required"]).toBeTruthy();
  });

  it("tasks/get returns stored task", async () => {
    const sent = await handleA2aJsonRpc({
      env,
      body: {
        jsonrpc: "2.0",
        id: 2,
        method: "message/send",
        params: {
          message: {
            role: "user",
            parts: [],
            metadata: { skillId: "oracle_diagnose_402", input: {} },
          },
        },
      },
    });
    const taskId = (sent.body as { result: { id: string } }).result.id;
    const got = await handleA2aJsonRpc({
      env,
      body: { jsonrpc: "2.0", id: 3, method: "tasks/get", params: { id: taskId } },
    });
    expect((got.body as { result: { id: string } }).result.id).toBe(taskId);
    expect(getA2aTask(taskId)?.id).toBe(taskId);
  });

  it("message/send oracle_health completes without a payment receipt", async () => {
    const res = await handleA2aJsonRpc({
      env,
      body: {
        jsonrpc: "2.0",
        id: 4,
        method: "message/send",
        params: {
          message: {
            role: "user",
            parts: [],
            metadata: { skillId: "oracle_health" },
          },
        },
      },
    });
    const task = (
      res.body as {
        result: {
          status: {
            state: string;
            message: {
              metadata: Record<string, unknown>;
              parts: Array<{ data?: { result?: { network?: string } } }>;
            };
          };
        };
      }
    ).result;
    expect(task.status.state).toBe("completed");
    expect(task.status.message.metadata["x402.payment.status"]).toBe("not-required");
    expect(task.status.message.metadata).not.toHaveProperty("x402.payment.receipts");
    expect(task.status.message.parts[0]?.data?.result?.network).toBe("eip155:8453");
  });

  it("agent card points at /a2a with supportedInterfaces", () => {
    const card = agentCard(env);
    expect(card.url).toBe(a2aEndpointUrl(env));
    expect(card.defaultInputModes).toContain("application/json");
    expect(card.supportedInterfaces?.[0]?.url).toContain("/a2a");
    expect(card.securitySchemes?.x402Payment?.type).toBe("apiKey");
  });
});
