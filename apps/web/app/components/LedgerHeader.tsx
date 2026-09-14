"use client";

import { SERVICE } from "@x402orcle/oracle-brain/catalog";
import { CopyButton } from "./CopyButton";
import { TelemetryBadge } from "./TelemetryBadge";

export function LedgerHeader({
  network,
  payTo,
  maxPriceUsd,
}: {
  network: string;
  payTo: string;
  maxPriceUsd: number;
}) {
  const isBaseSepolia = network.includes("84532");
  const baseScanUrl = isBaseSepolia
    ? `https://sepolia.basescan.org/address/${payTo}`
    : `https://basescan.org/address/${payTo}`;
  const networkScanUrl = isBaseSepolia
    ? "https://sepolia.basescan.org"
    : "https://basescan.org";

  return (
    <header className="ledger-header">
      <div className="top-nav-bar">
        <TelemetryBadge />
        <div className="nav-links">
          <a href="/docs" title="Interactive Hosted API Specification (Scalar)" className="nav-item badge-link">
            📚 /docs
          </a>
          <a href="/openapi.json" title="OpenAPI 3.1 Schema" className="nav-item">
            /openapi.json
          </a>
          <a href="/.well-known/x402" title="x402 Catalog" className="nav-item">
            /.well-known/x402
          </a>
          <a href="/mcp" title="MCP Streamable HTTP Endpoint" className="nav-item">
            /mcp
          </a>
        </div>
      </div>

      <div className="header-main-content margin-top">
        <p className="kicker">
          Inscribed ledger · {SERVICE.slug} · Base USDC (
          <a href={networkScanUrl} target="_blank" rel="noopener noreferrer" className="ledger-link">
            {network}
          </a>
          )
        </p>
        <h1 className="hero-title">{SERVICE.name}</h1>
        <p className="hero-thesis">{SERVICE.thesis}</p>
      </div>

      <div className="trust-card margin-top">
        <div className="trust-row">
          <span className="trust-label">Verified payTo Receiver Address:</span>
          <a
            href={baseScanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="contract-address-link"
            title="View onchain contract receiver address on BaseScan"
          >
            <code className="address-code">{payTo}</code>
            <span className="external-icon">↗</span>
          </a>
          <CopyButton text={payTo} label="Copy payTo" className="btn-sm" />
        </div>

        <div className="trust-row margin-top-xs">
          <span className="trust-label">Network Rail:</span>
          <a href={networkScanUrl} target="_blank" rel="noopener noreferrer" className="trust-value-link">
            <code>{network}</code> (Base Mainnet)
          </a>
          <span className="divider">·</span>
          <span className="trust-label">Max Consult Price Cap:</span>
          <span className="trust-value">${maxPriceUsd} USD</span>
        </div>
      </div>
    </header>
  );
}
