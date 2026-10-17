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

describe("a2a json-rpc", () => {
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

  it("agent card points at /a2a with supportedInterfaces", () => {
    const card = agentCard(env);
    expect(card.url).toBe(a2aEndpointUrl(env));
    expect(card.defaultInputModes).toContain("application/json");
    expect(card.supportedInterfaces?.[0]?.url).toContain("/a2a");
    expect(card.securitySchemes?.x402Payment?.type).toBe("apiKey");
  });
});
