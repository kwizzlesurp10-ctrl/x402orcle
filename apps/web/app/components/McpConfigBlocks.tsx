"use client";

import { useState } from "react";
import { CopyButton } from "./CopyButton";

export function McpConfigBlocks({ publicBaseUrl }: { publicBaseUrl: string }) {
  const [activeTab, setActiveTab] = useState<"claude" | "cursor" | "openwebui" | "windsurf">("claude");

  const mcpEndpoint = `${publicBaseUrl.replace(/\/$/, "")}/mcp`;

  const claudeConfig = {
    mcpServers: {
      x402oracle: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-fetch", mcpEndpoint],
        env: {
          X402_NETWORK: "eip155:8453",
        },
      },
    },
  };

  const cursorConfig = {
    mcpServers: {
      x402oracle: {
        url: mcpEndpoint,
        type: "streamable-http",
        headers: {
          "x402-version": "2",
        },
      },
    },
  };

  const openWebUiConfig = {
    name: "x402 Oracle MCP",
    url: mcpEndpoint,
    type: "streamable-http",
    tools: [
      "oracle_health",
      "oracle_pricing",
      "oracle_ask",
      "oracle_diagnose_402",
      "oracle_review_mcp",
      "oracle_bazaar_rewrite",
      "complete_oracle_task",
    ],
  };

  const windsurfConfig = {
    mcpServers: {
      "x402-oracle": {
        serverUrl: mcpEndpoint,
        transport: "streamable-http",
      },
    },
  };

  const currentSnippet =
    activeTab === "claude"
      ? JSON.stringify(claudeConfig, null, 2)
      : activeTab === "cursor"
      ? JSON.stringify(cursorConfig, null, 2)
      : activeTab === "openwebui"
      ? JSON.stringify(openWebUiConfig, null, 2)
      : JSON.stringify(windsurfConfig, null, 2);

  return (
    <section className="mcp-config-panel">
      <div className="section-header-block">
        <h2 className="section-title">🔌 Plug-and-Play MCP Server Integration</h2>
        <p className="section-subtitle">
          Mount <code className="code-inline">{mcpEndpoint}</code> directly into major AI desktop environments and agent frameworks.
        </p>
      </div>

      <div className="tab-container">
        <div className="tab-buttons">
          <button
            type="button"
            className={`tab-btn ${activeTab === "claude" ? "active" : ""}`}
            onClick={() => setActiveTab("claude")}
          >
            🤖 Claude Desktop
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "cursor" ? "active" : ""}`}
            onClick={() => setActiveTab("cursor")}
          >
            ⚡ Cursor IDE
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "openwebui" ? "active" : ""}`}
            onClick={() => setActiveTab("openwebui")}
          >
            🌐 Open WebUI
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "windsurf" ? "active" : ""}`}
            onClick={() => setActiveTab("windsurf")}
          >
            🏄 Windsurf / AGY
          </button>
        </div>

        <div className="tab-content">
          <div className="code-box-wrap">
            <div className="code-box-header">
              <span>
                {activeTab === "claude" && "claude_desktop_config.json"}
                {activeTab === "cursor" && ".cursor/mcp.json"}
                {activeTab === "openwebui" && "Open WebUI MCP Settings"}
                {activeTab === "windsurf" && "mcp_config.json"}
              </span>
              <CopyButton text={currentSnippet} label="Copy Config" />
            </div>
            <pre className="code-block"><code>{currentSnippet}</code></pre>
          </div>
        </div>
      </div>
    </section>
  );
}
