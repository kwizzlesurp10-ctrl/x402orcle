import { ImageResponse } from "next/og";

export const alt = "x402 Oracle — 402 is the answer";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: "#161310",
          backgroundImage: "radial-gradient(circle at 25% 25%, #2a2018 0%, #161310 70%)",
          padding: "60px 80px",
          fontFamily: "sans-serif",
          color: "#e8dcc4",
          border: "12px solid #241d17",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "80px",
            right: "80px",
            height: "4px",
            background: "linear-gradient(90deg, #b08d57, #c43b4e, #b08d57)",
          }}
        />
        <div
          style={{
            fontSize: 22,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "#b08d57",
            marginBottom: 16,
            fontWeight: 700,
          }}
        >
          Inscribed Ledger · Base USDC (eip155:8453)
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: -1,
            color: "#f5eee0",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
          }}
        >
          x402 Oracle
        </div>
        <div
          style={{
            fontSize: 32,
            color: "#c43b4e",
            marginBottom: 28,
            fontWeight: 600,
          }}
        >
          402 is the answer. The Oracle is how you ask.
        </div>
        <div
          style={{
            fontSize: 22,
            color: "#a89b88",
            maxWidth: "950px",
            lineHeight: 1.4,
            marginBottom: 36,
          }}
        >
          Paid &amp; Free MCP + HTTP 402 wisdom market for autonomous agents on Base.
          Instant state verification, attestation, 402 diagnostics, and Bazaar ranking.
        </div>
        <div
          style={{
            display: "flex",
            gap: "16px",
            fontSize: 18,
            color: "#b08d57",
          }}
        >
          <span style={{ background: "#251e18", padding: "8px 16px", borderRadius: 6, border: "1px solid #3d3126" }}>
            HTTP 402 Exact Scheme
          </span>
          <span style={{ background: "#251e18", padding: "8px 16px", borderRadius: 6, border: "1px solid #3d3126" }}>
            Streamable MCP Gateway
          </span>
          <span style={{ background: "#251e18", padding: "8px 16px", borderRadius: 6, border: "1px solid #3d3126" }}>
            Google A2A Protocol
          </span>
          <span style={{ background: "#251e18", padding: "8px 16px", borderRadius: 6, border: "1px solid #3d3126" }}>
            Base Mainnet USDC
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
