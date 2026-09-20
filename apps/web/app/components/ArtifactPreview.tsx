"use client";

import { useState } from "react";
import { CopyButton } from "./CopyButton";

export function ArtifactPreview({ payTo }: { payTo: string }) {
  const [viewMode, setViewMode] = useState<"human" | "agent">("human");

  const sampleReceipt = {
    tool: "oracle_ask",
    priceUsd: 0.1,
    network: "eip155:8453",
    payTo: payTo || "0x05e1720bB82F86B5bc7940a99FDC702E32256357",
    mode: "live",
    settlementId: "0x8f2a1b9c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
    transaction: "0x8f2a1b9c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
    payer: "0x3a4f100200300400500600700800900a00b00c0d",
    paidAt: "2026-09-14T08:35:00.000Z",
  };

  const sampleEnvelope = {
    verdict: "no_rank_without_settle",
    wisdom:
      "Cataloging and Bazaar rank indexing are settlement-triggered. Sending repeated 402 challenge probes without executing a verified onchain settlement will not index the resource.",
    implementation_prompt:
      "SYSTEM: Apply the following change with typed env (zod), price caps, no private keys on seller host, free health+pricing tools, and MAX_PRICE_USD=25.\nUSER: Execute one mainnet settlement from a local burner wallet with USDC on Base to index the resource URL in the CDP Bazaar search registry.",
    risk: "Burning USDC on frozen catalog copy without clearing cache fingerprints.",
    citations: [
      "https://docs.cdp.coinbase.com/x402/seller/get-discovered",
      "https://docs.cdp.coinbase.com/x402/buyer/discover-services",
    ],
    receipt: sampleReceipt,
  };

  return (
    <section className="artifact-preview-panel">
      <div className="section-header-block">
        <h2 className="section-title">📄 Consult Artifact Dual-Output Preview</h2>
        <p className="section-subtitle">
          Verified sample of a completed Oracle consult demonstrating dual outputs: calm prose for humans and structured compact JSON for autonomous agents.
        </p>
      </div>

      <div className="dual-toggle-bar">
        <button
          type="button"
          className={`toggle-tab ${viewMode === "human" ? "active" : ""}`}
          onClick={() => setViewMode("human")}
        >
          👤 Human View (Calm Prose + Action Prompt)
        </button>
        <button
          type="button"
          className={`toggle-tab ${viewMode === "agent" ? "active" : ""}`}
          onClick={() => setViewMode("agent")}
        >
          🤖 Agent View (Structured Compact JSON + Onchain Receipt)
        </button>
      </div>

      <div className="preview-container">
        {viewMode === "human" ? (
          <div className="human-view-box">
            <div className="verdict-banner">
              <span className="verdict-label">Verdict:</span>
              <span className="verdict-value">{sampleEnvelope.verdict}</span>
            </div>

            <div className="prose-section">
              <h4>Wisdom Summary</h4>
              <p>{sampleEnvelope.wisdom}</p>
            </div>

            <div className="prompt-section">
              <div className="section-title-copy">
                <h4>Executable Implementation Prompt for Builder Agent</h4>
                <CopyButton text={sampleEnvelope.implementation_prompt} label="Copy Prompt" />
              </div>
              <pre className="code-block"><code>{sampleEnvelope.implementation_prompt}</code></pre>
            </div>

            <div className="risk-section">
              <h4>Risk Assessment</h4>
              <p className="risk-text">⚠️ {sampleEnvelope.risk}</p>
            </div>

            <div className="citations-section">
              <h4>Citations & Documentation References</h4>
              <ul>
                {sampleEnvelope.citations.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="agent-view-box">
            <div className="code-box-header">
              <span>Compact JSON Wisdom Envelope</span>
              <CopyButton text={JSON.stringify(sampleEnvelope, null, 2)} label="Copy JSON" />
            </div>
            <pre className="code-block"><code>{JSON.stringify(sampleEnvelope, null, 2)}</code></pre>
          </div>
        )}
      </div>
    </section>
  );
}
