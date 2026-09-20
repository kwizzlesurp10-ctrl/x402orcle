import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_PAY_TO,
  RETIRED_PAY_TO_PREFIXES,
  isRetiredPayTo,
  loadEnv,
  recordRevenue,
  readRevenue,
  revenueSummary,
  recordChallenge,
  recordDemandSale,
  demandSnapshot,
  _resetLedgerMemoryForTests,
  _resetDemandMemoryForTests,
  handleConsult,
  buildDemoPaymentPayload,
  buildPaymentRequired,
  clampPrice,
  getTool,
} from "../src/index.js";

describe("payTo hygiene", () => {
  it("DEFAULT_PAY_TO is canonical sole cashier", () => {
    expect(DEFAULT_PAY_TO).toBe("0x05e1720bB82F86B5bc7940a99FDC702E32256357");
    expect(DEFAULT_PAY_TO).toHaveLength(42);
    expect(isRetiredPayTo(DEFAULT_PAY_TO)).toBe(false);
  });

  it("flags retired prefixes", () => {
    for (const p of RETIRED_PAY_TO_PREFIXES) {
      expect(isRetiredPayTo(`${p}${"0".repeat(32)}`)).toBe(true);
    }
  });

  it("defaults payTo when env omitted", () => {
    const e = loadEnv({
      DEMO_MODE: "true",
      PUBLIC_BASE_URL: "http://127.0.0.1:4021",
    });
    expect(e.payTo).toBe(DEFAULT_PAY_TO);
    expect(e.payToRetiredWarning).toBe(false);
  });

  it("warns when retired payTo configured", () => {
    const e = loadEnv({
      X402_PAY_TO: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
      DEMO_MODE: "true",
      PUBLIC_BASE_URL: "http://127.0.0.1:4021",
    });
    expect(e.payToRetiredWarning).toBe(true);
  });
});

describe("revenue ledger + demand", () => {
  beforeEach(() => {
    _resetLedgerMemoryForTests();
    _resetDemandMemoryForTests();
  });

  it("records external vs operator settles", () => {
    const operator = "0x1111111111111111111111111111111111111111";
    const external = "0x2222222222222222222222222222222222222222";
    const wallets = new Set([operator]);
    recordRevenue({
      productId: "oracle_ask",
      network: "eip155:8453",
      amountUsd: 0.1,
      payer: external,
      payTo: DEFAULT_PAY_TO,
      mode: "live",
      operatorWallets: wallets,
    });
    recordRevenue({
      productId: "oracle_ask",
      network: "eip155:8453",
      amountUsd: 0.1,
      payer: operator,
      payTo: DEFAULT_PAY_TO,
      mode: "live",
      operatorWallets: wallets,
    });
    const rows = readRevenue();
    expect(rows).toHaveLength(2);
    const summary = revenueSummary(rows);
    expect(summary.external_usdc).toBeCloseTo(0.1);
    expect(summary.operator_usdc).toBeCloseTo(0.1);
    expect(summary.external_sales).toBe(1);
    expect(summary.operator_sales).toBe(1);
  });

  it("joins challenges and sales in demand snapshot", () => {
    recordChallenge("oracle_ask");
    recordChallenge("oracle_ask");
    recordDemandSale({ resource: "oracle_ask", amountUsd: 0.1, isOperatorSettle: false });
    const snap = demandSnapshot();
    const row = snap.resources.find((r) => r.resource === "oracle_ask");
    expect(row?.challenges_served).toBe(2);
    expect(row?.sales_external).toBe(1);
    expect(row?.revenue_usdc).toBeCloseTo(0.1);
  });

  it("handleConsult challenge and demo settle write demand+ledger", async () => {
    const env = loadEnv({
      X402_PAY_TO: DEFAULT_PAY_TO,
      DEMO_MODE: "true",
      DEMO_ALLOW_PUBLIC: "true",
      PUBLIC_BASE_URL: "https://x402orcle.vercel.app",
      OPERATOR_WALLETS: "",
    });
    const challenge = await handleConsult({
      env,
      toolName: "oracle_ask",
      input: {},
      payment: null,
      transport: "http",
      execution: "challenge",
    });
    expect(challenge.status).toBe(402);

    const tool = getTool("oracle_ask")!;
    const priceUsd = clampPrice(tool, undefined, env.maxPriceUsd);
    const pr = buildPaymentRequired({ env, tool, priceUsd });
    const payment = buildDemoPaymentPayload({
      accepts: pr.accepts[0]!,
      resourceUrl: pr.resource.url,
    });
    const settled = await handleConsult({
      env,
      toolName: "oracle_ask",
      input: { question: "parity check?" },
      payment,
      transport: "http",
      execution: "execute",
    });
    expect(settled.status).toBe(200);
    expect(readRevenue().length).toBeGreaterThanOrEqual(1);
    expect(demandSnapshot().resources.some((r) => r.resource === "oracle_ask")).toBe(true);
  });
});
