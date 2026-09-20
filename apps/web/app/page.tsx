import { SERVICE, landingConsultCopy } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../lib/env";
import { LedgerHeader } from "./components/LedgerHeader";
import { MissionControlTelemetry } from "./components/MissionControlTelemetry";
import { WebTerminalEmulator } from "./components/WebTerminalEmulator";
import { Sandbox } from "./components/Sandbox";
import { SigValidatorWorkbench } from "./components/SigValidatorWorkbench";
import { CapabilityCards } from "./components/CapabilityCards";
import { CryptoDocs } from "./components/CryptoDocs";
import { GrokAndSwarmIntegrations } from "./components/GrokAndSwarmIntegrations";
import { McpConfigBlocks } from "./components/McpConfigBlocks";
import { MultiRuntimeSdk } from "./components/MultiRuntimeSdk";
import { ArtifactPreview } from "./components/ArtifactPreview";

export default function Page() {
  const env = oracleEnv();
  const consult = landingConsultCopy(env);

  return (
    <main className="slit-wrap" itemScope itemType="https://schema.org/SoftwareApplication">
      <div className="slit" aria-hidden="true" />
      <article className="ledger">
        {/* Ledger Header & Verified Trust Architecture */}
        <LedgerHeader
          network={env.network}
          payTo={env.payTo}
          maxPriceUsd={env.maxPriceUsd}
        />

        {/* Real-Time Mission Control Telemetry & First-Principles HUD */}
        <MissionControlTelemetry
          network={env.network}
          payTo={env.payTo}
        />

        {/* Interactive In-Browser CLI Terminal */}
        <WebTerminalEmulator
          payTo={env.payTo}
          network={env.network}
        />

        {/* Interactive Browser Payment Sandbox */}
        <Sandbox />

        {/* Real-Time Cryptographic Inspector & Verifier */}
        <SigValidatorWorkbench
          payTo={env.payTo}
          network={env.network}
        />

        {/* Capability Cards & Collapsible JSON Schemas */}
        <CapabilityCards payTo={env.payTo} />

        {/* Cryptographic Documentation ($SIG & EIP-712 Spec) */}
        <CryptoDocs />

        {/* xAI Grok & Autonomous Multi-Agent Swarm Orchestration */}
        <GrokAndSwarmIntegrations publicBaseUrl={env.publicBaseUrl} />

        {/* Plug-and-Play MCP Configuration Blocks */}
        <McpConfigBlocks publicBaseUrl={env.publicBaseUrl} />

        {/* Multi-Runtime SDK Code Examples */}
        <MultiRuntimeSdk publicBaseUrl={env.publicBaseUrl} />

        {/* Consult Artifact Dual-Output Preview */}
        <ArtifactPreview payTo={env.payTo} />

        {/* Machine Discovery Surfaces */}
        <nav aria-label="Machine Discovery Surfaces" className="margin-top">
          <p className="kicker">Machine Discovery Surfaces & Autonomous Agent Specs</p>
          <p>
            <a href="/docs" title="Interactive Hosted API Specification (Scalar)" className="badge-link">📚 /docs (Scalar API Specs)</a> ·{" "}
            <a href="/.well-known/x402" title="x402 Protocol Manifest">/.well-known/x402</a> ·{" "}
            <a href="/llms.txt" title="LLMs.txt Discovery">/llms.txt</a> ·{" "}
            <a href="/llms-full.txt" title="Full LLMs Reference">/llms-full.txt</a> ·{" "}
            <a href="/.well-known/agent-card.json" title="A2A Agent Card">agent-card.json</a> ·{" "}
            <a href="/.well-known/mcp.json" title="MCP Manifest">mcp.json</a> ·{" "}
            <a href="/.well-known/funding.json" title="Funding Details">funding.json</a> ·{" "}
            <a href="/openapi.json" title="OpenAPI 3.1 Specification">/openapi.json</a> ·{" "}
            <a href="/mcp" title="Streamable MCP Gateway">/mcp</a> ·{" "}
            <a href="/agents.txt" title="Agents.txt Permissions">/agents.txt</a> ·{" "}
            <a href="/jsonld" title="Schema.org JSON-LD Graph">/jsonld</a>
          </p>
        </nav>

        <footer>
          payTo address{" "}
          <a
            href={
              env.network.includes("84532")
                ? `https://sepolia.basescan.org/address/${env.payTo}`
                : `https://basescan.org/address/${env.payTo}`
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            {env.payTo}
          </a>{" "}
          · {env.network} · MAX_PRICE_USD={env.maxPriceUsd} · payment for consult artifacts, not a token, not equity.
        </footer>
      </article>
    </main>
  );
}
