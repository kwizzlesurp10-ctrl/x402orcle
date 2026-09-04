/**
 * FOSS wiring the Oracle teaches — used when DEMO_MODE=false.
 * Import-checked in tests so landing claims stay honest.
 */
export async function loadX402McpSurface(): Promise<{
  createPaymentWrapper: unknown;
  x402ResourceServer: unknown;
  declareDiscoveryExtension: unknown;
}> {
  const mcp = await import("@x402/mcp");
  const bazaar = await import("@x402/extensions/bazaar");
  return {
    createPaymentWrapper: mcp.createPaymentWrapper,
    x402ResourceServer: mcp.x402ResourceServer,
    declareDiscoveryExtension: bazaar.declareDiscoveryExtension,
  };
}
