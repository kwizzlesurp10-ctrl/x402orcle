import { describe, expect, it } from "vitest";
import request from "supertest";
import { loadEnv } from "@x402orcle/oracle-brain";
import { createOracleApp } from "../src/app.js";

const env = loadEnv({
  X402_PAY_TO: "0x05e1720bB82F86B5bc7940a99FDC702E32256357",
  X402_NETWORK: "eip155:8453",
  DEMO_MODE: "true",
  PUBLIC_BASE_URL: "http://127.0.0.1:4021",
  MAX_PRICE_USD: "25",
});

const app = createOracleApp(env);

describe("oracle http", () => {
  it("health is free and seller-only", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.wallet_configured).toBe(false);
    expect(res.body.pay_to_configured).toBe(true);
  });

  it("unpaid consult is 402 with bazaar", async () => {
    const res = await request(app)
      .post("/api/consult/oracle_ask")
      .send({ question: "How do I rank on Bazaar?" });
    expect(res.status).toBe(402);
    expect(res.headers["payment-required"]).toBeTruthy();
    expect(res.body.extensions.bazaar.info.input.method).toBe("POST");
    expect(res.body.extensions.bazaar.schema.$schema).toMatch(/json-schema/);
    expect(res.body.resource.url).toContain("/api/consult/oracle_ask");
  });

  it("validates POST before payment and returns typed 400/404 errors", async () => {
    const invalid = await request(app)
      .post("/api/consult/oracle_ask")
      .send({ audience: "agent" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("INVALID_REQUEST");
    expect(invalid.body.issues[0].path).toBe("question");

    const missing = await request(app)
      .post("/api/consult/not_a_tool")
      .send({ question: "ignored" });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("TOOL_NOT_FOUND");
  });

  it("keeps GET crawler-only even when payment is supplied", async () => {
    const mint = await request(app).post("/v1/demo/mint-payment").send({ tool: "oracle_ask" });
    const challenge = await request(app)
      .get("/api/consult/oracle_ask")
      .set("PAYMENT-SIGNATURE", mint.body.payment_signature_header);
    expect(challenge.status).toBe(402);
    expect(challenge.body.error).toBe("PAYMENT_REQUIRED");
    expect(challenge.headers["payment-response"]).toBeUndefined();
  });

  it("demo payment returns wisdom envelope + receipt", async () => {
    const mint = await request(app).post("/v1/demo/mint-payment").send({ tool: "oracle_ask" });
    expect(mint.status).toBe(200);
    const paid = await request(app)
      .post("/api/consult/oracle_ask")
      .set("PAYMENT-SIGNATURE", mint.body.payment_signature_header)
      .send({ question: "Why no rank without settlement?" });
    expect(paid.status).toBe(200);
    expect(paid.body.verdict).toBeTruthy();
    expect(paid.body.implementation_prompt).toMatch(/SYSTEM:/);
    expect(paid.body.receipt.mode).toBe("demo");
    const paymentResponse = JSON.parse(
      Buffer.from(paid.headers["payment-response"], "base64").toString("utf8"),
    ) as { success?: boolean; network?: string };
    expect(paymentResponse).toEqual(
      expect.objectContaining({ success: true, network: env.network }),
    );
  });

  it("llms.txt and agent-card are crawlable", async () => {
    const llms = await request(app).get("/llms.txt");
    expect(llms.status).toBe(200);
    expect(llms.text).toContain("0x05e1720bB82F86B5bc7940a99FDC702E32256357");
    const card = await request(app).get("/.well-known/agent-card.json");
    expect(card.body.payments.rails[0].id).toBe("x402");
    const x402 = await request(app).get("/.well-known/x402");
    expect(x402.body.payTo).toBe(env.payTo);
  });

  it("MCP unpaid tool returns PaymentRequired structuredContent", async () => {
    const res = await request(app)
      .post("/mcp")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "oracle_ask", arguments: { question: "mcp 402?" } },
      });
    expect(res.status).toBe(200);
    expect(res.body.result.isError).toBe(true);
    expect(res.body.result.structuredContent.x402Version).toBe(2);
  });

  it("landing has JSON-LD and thesis", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("application/ld+json");
    expect(res.text).toContain("402 is the answer");
    expect(res.text).toContain("/v1/demo/mint-payment");
  });

  it("https public host refuses demo mint", async () => {
    const liveEnv = loadEnv({
      X402_PAY_TO: "0x05e1720bB82F86B5bc7940a99FDC702E32256357",
      X402_NETWORK: "eip155:8453",
      DEMO_MODE: "true",
      PUBLIC_BASE_URL: "https://x402orcle.vercel.app",
      MAX_PRICE_USD: "25",
    });
    const liveApp = createOracleApp(liveEnv);
    const mint = await request(liveApp).post("/v1/demo/mint-payment").send({ tool: "oracle_ask" });
    expect(mint.status).toBe(403);
    const health = await request(liveApp).get("/health");
    expect(health.body.demoMode).toBe(false);
    const landing = await request(liveApp).get("/");
    expect(landing.text).not.toContain("/v1/demo/mint-payment");
    expect(landing.text).toContain("PAYMENT-SIGNATURE");
  });

  it("/docs returns hosted API documentation", async () => {
    const res = await request(app).get("/docs");
    expect(res.status).toBe(200);
    expect(res.text).toContain("API Documentation");
    expect(res.text).toContain("scalar");
  });

  it("exposes mcp-parity ops surfaces", async () => {
    const challenge = await request(app).get("/api/consult/oracle_ask");
    expect(challenge.status).toBe(402);
    const mint = await request(app).post("/v1/demo/mint-payment").send({ tool: "oracle_ask" });
    await request(app)
      .post("/api/consult/oracle_ask")
      .set("PAYMENT-SIGNATURE", mint.body.payment_signature_header)
      .send({ question: "ledger parity?" });
    const ledger = await request(app).get("/ledger/revenue");
    expect(ledger.status).toBe(200);
    expect(Array.isArray(ledger.body)).toBe(true);
    expect(ledger.body.length).toBeGreaterThanOrEqual(1);
    const swarm = await request(app).get("/swarm/revenue");
    expect(swarm.status).toBe(200);
    expect(swarm.body.settled_sales).toBeGreaterThanOrEqual(1);
    const demand = await request(app).get("/demand");
    expect(demand.status).toBe(200);
    expect(demand.body.resources.length).toBeGreaterThanOrEqual(1);
    const wallet = await request(app).get("/wallet");
    expect(wallet.status).toBe(200);
    expect(wallet.body.receive_address).toBe(env.payTo);
    expect(wallet.body.pay_to_retired_warning).toBe(false);
  });
});
