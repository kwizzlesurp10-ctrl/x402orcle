import { describe, expect, it } from "vitest";
import {
  loadEnv,
  openApi,
  agentCard,
  parsePaymentHeader,
  toChecksumAddress,
  A2A_X402_EXTENSION_URI,
} from "../src/index.js";

const env = loadEnv({
  X402_PAY_TO: "0xab745e5f576667037696e78ba7da28e193e4423d",
  DEMO_MODE: "true",
  PUBLIC_BASE_URL: "https://x402orcle.vercel.app",
});

describe("audit hardening", () => {
  it("EIP-55 checksum preserves address identity", () => {
    const raw = "0xab745e5f576667037696e78ba7da28e193e4423d";
    const sum = toChecksumAddress(raw);
    expect(sum.toLowerCase()).toBe(raw.toLowerCase());
    expect(sum).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(sum).not.toBe(raw);
  });

  it("parsePaymentHeader distinguishes invalid base64", () => {
    expect(parsePaymentHeader("").kind).toBe("absent");
    expect(parsePaymentHeader("%%%not-base64%%%").kind).toBe("invalid");
    expect(parsePaymentHeader('{"x402Version":2}').kind).toBe("present");
  });

  it("agent card drops legacy 404 extension uri", () => {
    const uris = agentCard(env).capabilities?.extensions?.map((e) => e.uri) ?? [];
    expect(uris).not.toContain("https://github.com/google-a2a/a2a-x402/v0.1");
    expect(uris).toContain(A2A_X402_EXTENSION_URI);
  });

  it("openapi documents discovery and RPC routes", () => {
    const spec = openApi(env) as { paths: Record<string, unknown> };
    for (const path of [
      "/a2a",
      "/mcp",
      "/health",
      "/.well-known/x402",
      "/.well-known/agent-card.json",
      "/.well-known/mcp.json",
      "/.well-known/mcp",
      "/.well-known/funding.json",
      "/.well-known/agents.json",
    ]) {
      expect(spec.paths[path], path).toBeTruthy();
    }
  });
});
