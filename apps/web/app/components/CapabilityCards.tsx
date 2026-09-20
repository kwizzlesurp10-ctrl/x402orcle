"use client";

import { useState } from "react";
import { TOOLS, type OracleToolSpec } from "@x402orcle/oracle-brain/catalog";
import { CopyButton } from "./CopyButton";

export function CapabilityCards({ payTo }: { payTo: string }) {
  const [openSchema, setOpenSchema] = useState<Record<string, boolean>>({});

  const toggleSchema = (toolName: string) => {
    setOpenSchema((prev) => ({ ...prev, [toolName]: !prev[toolName] }));
  };

  const freeTools = TOOLS.filter((t) => t.tier === "free");
  const paidTools = TOOLS.filter((t) => t.tier === "paid");

  return (
    <section className="capabilities-panel">
      <div className="section-header-block">
        <h2 className="section-title">⚡ Oracle Capabilities & Interactive Schema Catalog</h2>
        <p className="section-subtitle">
          Explore Free liveness tools and Paid USDC consultative capabilities. Every endpoint exposes explicit machine-readable JSON input/output schemas.
        </p>
      </div>

      {/* Free Endpoints Group */}
      <div className="capability-group">
        <div className="group-title-row">
          <span className="badge badge-green">FREE ENDPOINTS (0.00 USDC)</span>
          <span className="group-desc">Instant liveness, pricing discovery, and connection guides without payment.</span>
        </div>

        <div className="cards-grid">
          {freeTools.map((t) => (
            <ToolCard key={t.name} tool={t} isOpen={Boolean(openSchema[t.name])} onToggle={() => toggleSchema(t.name)} />
          ))}
        </div>
      </div>

      {/* Paid Endpoints Group */}
      <div className="capability-group margin-top">
        <div className="group-title-row">
          <span className="badge badge-amber">PAID CONSULTATIVE ENDPOINTS (HTTP 402 & MCP)</span>
          <span className="group-desc">Expert wisdom envelopes, 402 diagnostics, MCP reviews, and outcome-driven A2A tasks on Base USDC.</span>
        </div>

        <div className="cards-grid">
          {paidTools.map((t) => (
            <ToolCard key={t.name} tool={t} isOpen={Boolean(openSchema[t.name])} onToggle={() => toggleSchema(t.name)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ToolCard({
  tool,
  isOpen,
  onToggle,
}: {
  tool: OracleToolSpec;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const inputSchema = tool.inputSchema;
  const outputSchema = tool.outputSchema;

  return (
    <div className={`capability-card ${tool.tier === "paid" ? "card-paid" : "card-free"}`}>
      <div className="card-top">
        <div className="card-title-wrap">
          <h3 className="tool-title">{tool.serviceName}</h3>
          <code className="tool-slug">{tool.name}</code>
        </div>
        <div className="card-price-badge">
          {tool.tier === "free" ? (
            <span className="price-tag free">FREE</span>
          ) : (
            <span className="price-tag paid">${tool.priceUsd.toFixed(2)} USDC</span>
          )}
        </div>
      </div>

      <p className="tool-desc">{tool.description}</p>

      <div className="tool-meta-row">
        <span className="meta-pill">{tool.httpMethod} {tool.httpPath}</span>
        {tool.tags.map((tag) => (
          <span key={tag} className="tag-pill">#{tag}</span>
        ))}
      </div>

      {/* Schema Expander Toggle */}
      <div className="schema-toggle-wrap">
        <button type="button" className="btn-schema-toggle" onClick={onToggle}>
          <span>{isOpen ? "▼ Hide JSON Schemas & Examples" : "▶ View Explicit Input & Output JSON Schemas"}</span>
        </button>
      </div>

      {isOpen && (
        <div className="schemas-container">
          <div className="schema-box">
            <div className="schema-box-header">
              <span>Input Schema (JSON Schema 2020-12)</span>
              <CopyButton text={JSON.stringify(inputSchema, null, 2)} label="Copy Schema" />
            </div>
            <pre className="code-block"><code>{JSON.stringify(inputSchema, null, 2)}</code></pre>

            <div className="schema-box-header margin-top-xs">
              <span>Input Example</span>
            </div>
            <pre className="code-block"><code>{JSON.stringify(tool.inputExample, null, 2)}</code></pre>
          </div>

          <div className="schema-box">
            <div className="schema-box-header">
              <span>Output Schema (Wisdom Envelope)</span>
              <CopyButton text={JSON.stringify(outputSchema, null, 2)} label="Copy Schema" />
            </div>
            <pre className="code-block"><code>{JSON.stringify(outputSchema, null, 2)}</code></pre>

            <div className="schema-box-header margin-top-xs">
              <span>Output Example</span>
            </div>
            <pre className="code-block"><code>{JSON.stringify(tool.outputExample, null, 2)}</code></pre>
          </div>
        </div>
      )}
    </div>
  );
}
