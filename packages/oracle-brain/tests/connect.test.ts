import { describe, expect, it } from "vitest";
import { connectDocument, loadEnv, PAID_TOOLS } from "../src/index.js";

describe("connectDocument", () => {
  it("returns the live payTo, catalog, and ledger rows without a buyer key", () => {
    const env = loadEnv({
      X402_PAY_TO: "0x1111111111111111111111111111111111111111",
      X402_NETWORK: "eip155:8453",
      DEMO_MODE: "false",
      PUBLIC_BASE_URL: "http://127.0.0.1:4021",
      CDP_API_KEY_ID: "test-id",
      CDP_API_KEY_SECRET: "test-secret",
    });
    const doc = connectDocument(env);
    expect(doc.linked).toBe(true);
    expect(doc.slug).toBe("x402orcle");
    expect(doc.pricing.payTo).toBe(env.payTo);
    expect(doc.pricing.connect.length).toBeGreaterThan(0);
    expect(doc.pricing.paid).toHaveLength(PAID_TOOLS.length);
    expect(doc.health.wallet_configured).toBe(false);
    expect(doc.health.demoMode).toBe(false);
    expect(doc.health.cdp_auth_configured).toBe(true);
    expect(doc.wallet.vault_address).toBeNull();
    expect(doc.wallet.balances).toBeNull();
    expect(doc.revenue_summary.settled_sales).toBe(doc.revenue.length);
    expect(Array.isArray(doc.demand.resources)).toBe(true);
  });
});
