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

  it("unpaid empty-body POST is 402 for every paid consult", async () => {
    for (const tool of ["oracle_ask", "oracle_diagnose_402", "oracle_review_mcp", "oracle_bazaar_rewrite", "complete_oracle_task"]) {
      const res = await request(app).post(`/api/consult/${tool}`).set("Content-Type", "application/json");
      expect(res.status).toBe(402);
      expect(res.headers["payment-required"]).toBeTruthy();
    }
  });

  it("a2a message/send unpaid returns payment-required task", async () => {
    const res = await request(app)
      .post("/a2a")
      .send({
        jsonrpc: "2.0",
        id: 9,
        method: "message/send",
        params: {
          message: {
            role: "user",
            parts: [],
            metadata: { skillId: "oracle_ask", input: { question: "mcp?" } },
          },
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.result.status.state).toBe("input-required");
    expect(res.body.result.status.message.metadata["x402.payment.required"]).toBeTruthy();
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
    expect(res.text).toContain("/v1/demo/mint-payment");
  });

  it("serves OpenAPI document with contact email, security: [], and FundingResponse schema (R1, R2, R3)", async () => {
    const res = await request(app).get("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.info.contact.email).toBe("kwizzlesurp10@gmail.com");
    expect(res.body.paths["/api/health"].get.security).toEqual([]);
    expect(res.body.paths["/api/pricing"].get.security).toEqual([]);
    expect(res.body.paths["/.well-known/funding.json"].get.security).toEqual([]);
    expect(res.body.components.schemas.FundingResponse).toBeDefined();
    expect(
      res.body.paths["/.well-known/funding.json"].get.responses["200"].content["application/json"].schema.$ref,
    ).toBe("#/components/schemas/FundingResponse");
  });

  it("serves /.well-known/funding.json matching FundingResponse schema without auth", async () => {
    const res = await request(app).get("/.well-known/funding.json");
    expect(res.status).toBe(200);
    expect(res.body.schema_version).toBe("1.0");
    expect(res.body.payTo).toBe(env.payTo);
    expect(res.body.machineCashier.protocol).toBe("x402");
    expect(res.body.discovery.openapi).toBeTruthy();
  });

  it("https public host refuses demo mint", async () => {
    const liveEnv = loadEnv({
      X402_PAY_TO: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
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
});
