import { describe, expect, it } from "vitest";
import { TOOLS, loadEnv, wellKnownX402 } from "../src/index.js";

const env = loadEnv({
  X402_PAY_TO: "0x0d25A44f74868eCE53B305C97139CF4B62963410",
  PUBLIC_BASE_URL: "http://127.0.0.1:4021",
  DEMO_MODE: "true",
});

describe("catalog examples", () => {
  it("fills output examples and advertises a network on free health", () => {
    expect(env.network).toBe("eip155:8453");
    for (const tool of TOOLS) {
      expect(JSON.stringify(tool.outputExample)).not.toContain("…");
    }
    const health = wellKnownX402(env).resource_details.find((row) => row.mcp_url === "mcp://tool/oracle_health");
    expect(health?.network).toBe("eip155:8453");
    expect(health?.price).toBe("free");
  });
});
