import { describe, expect, it } from "vitest";
import {
  backfillDiscovery,
  bazaarIndexingStatus,
  buildPaymentRequired,
  handleConsult,
  loadEnv,
  PAID_TOOLS,
  requireTool,
} from "../src/index.js";

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64");

function liveEnv() {
  return loadEnv({
    X402_PAY_TO: "0x0d25A44f74868eCE53B305C97139CF4B62963410",
    PUBLIC_BASE_URL: "https://x402orcle.vercel.app",
    DEMO_MODE: "false",
  });
}

function recordingFetch(settleHeader?: string, settleBody: Record<string, unknown> = {}) {
  const calls: { url: string; body: any }[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, body: JSON.parse(String(init?.body)) });
    if (u.endsWith("/verify")) {
      return new Response(JSON.stringify({ isValid: true, payer: "0xabc" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (settleHeader) headers["EXTENSION-RESPONSES"] = settleHeader;
    return new Response(
      JSON.stringify({ success: true, payer: "0xabc", transaction: "0xtx", network: "eip155:8453", ...settleBody }),
      { status: 200, headers },
    );
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("bazaar discovery backfill before settle", () => {
  it("verify and settle carry resource + extensions.bazaar the buyer omitted", async () => {
    const env = liveEnv();
    const pr = buildPaymentRequired({ env, tool: requireTool("oracle_ask"), priceUsd: 0.1 });
    const { fetchImpl, calls } = recordingFetch(b64({ bazaar: { status: "processing" } }));
    const buyer = { x402Version: 2, accepted: pr.accepts[0], payload: { signature: "0xsig" } };
    const res = await handleConsult({
      env,
      toolName: "oracle_ask",
      input: { question: "Why no rank without settlement?" },
      payment: buyer,
      transport: "http",
      fetchImpl,
    });
    expect(res.status).toBe(200);
    const settle = calls.find((c) => c.url.endsWith("/settle"))!;
    const verify = calls.find((c) => c.url.endsWith("/verify"))!;
    for (const c of [settle, verify]) {
      expect(c.body.paymentPayload.resource).toEqual(pr.resource);
      expect(c.body.paymentPayload.extensions.bazaar).toEqual(pr.extensions.bazaar);
      expect(c.body.paymentPayload.payload).toEqual({ signature: "0xsig" });
    }
    expect(settle.body.paymentRequirements).toEqual(pr.accepts[0]);
    expect(buyer).not.toHaveProperty("resource");
    const receipt = (res.body as { receipt: Record<string, unknown> }).receipt;
    expect(receipt.bazaarIndexing).toEqual({ status: "processing", source: "extension-responses-header" });
    expect(receipt.discoveryBackfilled).toEqual({ resource: true, bazaar: true });
    expect(receipt.transaction).toBe("0xtx");
  });

  it("replaces buyer-altered resource/bazaar with ours and records rejected reason from settle body", async () => {
    const env = liveEnv();
    const pr = buildPaymentRequired({ env, tool: requireTool("oracle_ask"), priceUsd: 0.1 });
    const { fetchImpl, calls } = recordingFetch(undefined, {
      extensions: { bazaar: { status: "rejected", rejectedReason: "info failed schema validation" } },
    });
    const mine = { url: "https://x402orcle.vercel.app/api/consult/oracle_ask", description: "buyer" };
    const res = await handleConsult({
      env,
      toolName: "oracle_ask",
      input: { question: "q" },
      payment: { x402Version: 2, accepted: pr.accepts[0], resource: mine, extensions: { bazaar: { info: { x: 1 } } } },
      transport: "http",
      fetchImpl,
    });
    const settle = calls.find((c) => c.url.endsWith("/settle"))!;
    expect(settle.body.paymentPayload.resource).toEqual(pr.resource);
    expect(settle.body.paymentPayload.extensions.bazaar).toEqual(pr.extensions.bazaar);
    const receipt = (res.body as { receipt: Record<string, unknown> }).receipt;
    expect(receipt.bazaarIndexing).toEqual({
      status: "rejected",
      rejectedReason: "info failed schema validation",
      source: "response-body",
    });
    expect(receipt.discoveryBackfilled).toEqual({ resource: true, bazaar: true });
  });

  it("leaves a byte-equal echo of our challenge alone", async () => {
    const env = liveEnv();
    const pr = buildPaymentRequired({ env, tool: requireTool("oracle_ask"), priceUsd: 0.1 });
    const { fetchImpl } = recordingFetch();
    const res = await handleConsult({
      env,
      toolName: "oracle_ask",
      input: { question: "q" },
      payment: { x402Version: 2, accepted: pr.accepts[0], resource: pr.resource, extensions: pr.extensions },
      transport: "http",
      fetchImpl,
    });
    expect((res.body as { receipt: Record<string, unknown> }).receipt.discoveryBackfilled).toEqual({
      resource: false,
      bazaar: false,
    });
  });

  it("reports not_reported when the facilitator sends no indexing signal", async () => {
    const env = liveEnv();
    const { fetchImpl } = recordingFetch();
    const res = await handleConsult({
      env,
      toolName: "oracle_ask",
      input: { question: "q" },
      payment: { x402Version: 2 },
      transport: "http",
      fetchImpl,
    });
    expect((res.body as { receipt: Record<string, unknown> }).receipt.bazaarIndexing).toEqual({
      status: "not_reported",
      source: "none",
    });
  });

  it("helpers: mcp:// resource is absolute; header beats body", () => {
    const p: Record<string, unknown> = {};
    backfillDiscovery(p, { resource: { url: "mcp://tool/oracle_ask" }, bazaar: { info: {} } });
    expect((p.resource as { url: string }).url).toBe("mcp://tool/oracle_ask");
    expect(
      bazaarIndexingStatus({
        extensionResponsesHeader: b64({ bazaar: { status: "success" } }),
        responseBody: { extensions: { bazaar: { status: "rejected" } } },
      }).status,
    ).toBe("success");
  });
});

describe("backfill safety and verify-reported status", () => {
  it("settles with our canonical resource even when the buyer sent a foreign or altered one", async () => {
    const env = liveEnv();
    const pr = buildPaymentRequired({ env, tool: requireTool("oracle_ask"), priceUsd: 0.1 });
    for (const bad of [
      { url: "https://attacker.example/x" },
      { ...pr.resource, serviceName: "Totally Legit" },
      { ...pr.resource, url: `${pr.resource.url}?ref=evil` },
      { ...pr.resource, iconUrl: "https://attacker.example/i.png" },
    ]) {
      const { fetchImpl, calls } = recordingFetch();
      await handleConsult({
        env,
        toolName: "oracle_ask",
        input: { question: "q" },
        payment: { x402Version: 2, accepted: pr.accepts[0], resource: bad, extensions: { other: 1 } },
        transport: "http",
        fetchImpl,
      });
      const settle = calls.find((c) => c.url.endsWith("/settle"))!;
      expect(settle.body.paymentPayload.resource).toEqual(pr.resource);
      expect(settle.body.paymentPayload.extensions).toEqual({ other: 1, bazaar: pr.extensions.bazaar });
    }
  });

  it("keeps a rejection reported only on verify", async () => {
    const env = liveEnv();
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL) => {
      const u = String(url);
      calls.push(u);
      if (u.endsWith("/verify")) {
        return new Response(JSON.stringify({ isValid: true, payer: "0xabc" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "EXTENSION-RESPONSES": b64({ bazaar: { status: "rejected", rejectedReason: "bad schema" } }),
          },
        });
      }
      return new Response(JSON.stringify({ success: true, payer: "0xabc", transaction: "0xtx" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
    const res = await handleConsult({
      env,
      toolName: "oracle_ask",
      input: { question: "q" },
      payment: { x402Version: 2 },
      transport: "http",
      fetchImpl,
    });
    expect((res.body as { receipt: Record<string, unknown> }).receipt.bazaarIndexing).toEqual({
      status: "rejected",
      rejectedReason: "bad schema",
      source: "verify:extension-responses-header",
    });
  });
});

describe("discovery metadata avoids agent-directed prompt wording", () => {
  it("paid challenges carry no 'prompt' / instruction phrasing", () => {
    const env = liveEnv();
    for (const tool of PAID_TOOLS) {
      const pr = buildPaymentRequired({ env, tool, priceUsd: tool.priceUsd });
      const text = JSON.stringify({ resource: pr.resource, extensions: pr.extensions });
      expect(text).not.toMatch(/prompt|ignore (all|previous)|you must|system:/i);
    }
  });
});
