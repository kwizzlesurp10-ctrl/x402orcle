import { describe, expect, it } from "vitest";
import request from "supertest";
import { loadEnv } from "@x402orcle/oracle-brain";
import { createOracleApp } from "../src/app.js";

const env = loadEnv({
  X402_PAY_TO: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
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
  });

  it("llms.txt and agent-card are crawlable", async () => {
    const llms = await request(app).get("/llms.txt");
    expect(llms.status).toBe(200);
    expect(llms.text).toContain("0xAB745e5F576667037696e78ba7dA28E193E4423D");
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
  });
});
