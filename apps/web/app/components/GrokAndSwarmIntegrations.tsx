"use client";

import { useState } from "react";
import { CopyButton } from "./CopyButton";

export function GrokAndSwarmIntegrations({ publicBaseUrl }: { publicBaseUrl: string }) {
  const [activeFramework, setActiveFramework] = useState<"grok" | "langgraph" | "crewai" | "rust" | "python_async">("grok");

  const baseUrl = publicBaseUrl.replace(/\/$/, "");

  const grokCode = `// xAI Grok Function-Calling & Tool Definition for x402 Oracle
const grokOracleTool = {
  type: "function",
  function: {
    name: "x402_oracle_consult",
    description: "Autonomous blockchain oracle providing smart contract attestation, 402 diagnostics, and Bazaar ranking optimizations on Base USDC.",
    parameters: {
      type: "object",
      properties: {
        tool_name: {
          type: "string",
          enum: ["oracle_ask", "oracle_diagnose_402", "oracle_review_mcp", "oracle_bazaar_rewrite", "complete_oracle_task"],
          description: "The specific Oracle capability to invoke"
        },
        payload: {
          type: "object",
          description: "The JSON input parameters for the selected Oracle tool"
        }
      },
      required: ["tool_name", "payload"]
    }
  }
};

// Grok Agent Tool Executor with Automated 402 Signer
async function executeGrokToolCall(toolName, payload, walletSigner) {
  const url = \`${baseUrl}/api/consult/\${toolName}\`;
  
  // 1. Initial 402 Probe
  const probe = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (probe.status === 402) {
    const prHeader = probe.headers.get("PAYMENT-REQUIRED");
    const challenge = JSON.parse(Buffer.from(prHeader, "base64").toString());
    
    // 2. Sign EIP-712 TransferWithAuthorization on Base
    const paymentSig = await walletSigner.sign402Challenge(challenge.accepts[0]);
    
    // 3. Resend with PAYMENT-SIGNATURE
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "PAYMENT-SIGNATURE": paymentSig
      },
      body: JSON.stringify(payload)
    });
    return await res.json();
  }
  return await probe.json();
}`;

  const langGraphCode = `import { StateGraph, Annotation } from "@langchain/langgraph";

// State Annotation with Payment Envelope Buffer
const OracleState = Annotation.Root({
  question: Annotation<string>(),
  challenge: Annotation<any>(),
  signature: Annotation<string>(),
  wisdomEnvelope: Annotation<any>()
});

// Node 1: Probe Oracle Endpoint
async function probeOracle(state: typeof OracleState.State) {
  const res = await fetch("${baseUrl}/api/consult/oracle_ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: state.question, audience: "agent" })
  });
  if (res.status === 402) {
    const raw = res.headers.get("PAYMENT-REQUIRED")!;
    const challenge = JSON.parse(Buffer.from(raw, "base64").toString());
    return { challenge };
  }
  return { wisdomEnvelope: await res.json() };
}

// Node 2: Autonomous Agent Wallet EIP-712 Signer
async function signPayment(state: typeof OracleState.State) {
  // Sign EIP-712 authorization on Base (USDC 0x8335...02913)
  const signature = await agentWallet.signEip712(state.challenge.accepts[0]);
  return { signature };
}

// Node 3: Settle & Retrieve Wisdom
async function settleConsult(state: typeof OracleState.State) {
  const res = await fetch("${baseUrl}/api/consult/oracle_ask", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "PAYMENT-SIGNATURE": state.signature
    },
    body: JSON.stringify({ question: state.question, audience: "agent" })
  });
  return { wisdomEnvelope: await res.json() };
}

export const oracleGraph = new StateGraph(OracleState)
  .addNode("probe", probeOracle)
  .addNode("sign", signPayment)
  .addNode("settle", settleConsult)
  .addEdge("__start__", "probe")
  .addConditionalEdges("probe", (s) => s.challenge ? "sign" : "__end__")
  .addEdge("sign", "settle")
  .addEdge("settle", "__end__")
  .compile();`;

  const crewAiCode = `from crewai import Agent, Task, Crew
import httpx, base64, json

class x402OracleTool:
    @staticmethod
    def consult(question: str) -> str:
        url = "${baseUrl}/api/consult/oracle_ask"
        client = httpx.Client()
        r = client.post(url, json={"question": question, "audience": "agent"})
        if r.status_code == 402:
            pr_b64 = r.headers.get("PAYMENT-REQUIRED")
            # Sign EIP-712 challenge via CDP AgentKit / Agentic Wallet
            sig = sign_eip712_challenge(pr_b64)
            settled = client.post(url, json={"question": question}, headers={"PAYMENT-SIGNATURE": sig})
            return settled.text
        return r.text

oracle_agent = Agent(
    role="Lead Systems Architect & Smart Contract Auditor",
    goal="Consult x402 Oracle on Base USDC to verify onchain state and Bazaar index readiness",
    backstory="Autonomous engineering agent equipped with cryptographic payment rails on Base L2.",
    tools=[x402OracleTool.consult]
)`;

  const rustCode = `// Cargo.toml: reqwest = { version = "0.12", features = ["json"] }, alloy = "0.1"
use reqwest::header::{HeaderMap, HeaderValue};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std.error::Error>> {
    let client = reqwest::Client::new();
    let url = "${baseUrl}/api/consult/oracle_ask";
    let body = json!({ "question": "Why is my Bazaar listing unranked?", "audience": "agent" });

    // Step 1: Send Unpaid Probe -> Expect HTTP 402
    let resp = client.post(url).json(&body).send().await?;
    
    if resp.status() == reqwest::StatusCode::PAYMENT_REQUIRED {
        let pr_header = resp.headers().get("PAYMENT-REQUIRED").unwrap().to_str()?;
        println!("Received 402 Challenge: {} bytes", pr_header.len());
        
        // Step 2: Sign EIP-712 with Alloy / Secp256k1
        // let payment_sig = sign_alloy_eip712(pr_header, &private_key).await?;
    }
    Ok(())
}`;

  const pythonAsyncCode = `import asyncio, httpx, json, base64

async def async_consult_oracle(question: str, signer):
    url = "${baseUrl}/api/consult/oracle_ask"
    async with httpx.AsyncClient() as client:
        # 1. Unpaid Probe
        res = await client.post(url, json={"question": question, "audience": "agent"})
        if res.status_code == 402:
            pr_b64 = res.headers.get("PAYMENT-REQUIRED")
            challenge = json.loads(base64.b64decode(pr_b64).decode("utf-8"))
            
            # 2. Async Sign EIP-712
            payment_sig = await signer.sign_challenge_async(challenge["accepts"][0])
            
            # 3. Resend with Signature
            headers = {"PAYMENT-SIGNATURE": payment_sig, "Content-Type": "application/json"}
            res200 = await client.post(url, json={"question": question}, headers=headers)
            return res200.json()
        return res.json()

# Run concurrent multi-agent queries
# asyncio.run(async_consult_oracle("Verify Base USDC state", signer))`;

  const currentSnippet =
    activeFramework === "grok"
      ? grokCode
      : activeFramework === "langgraph"
      ? langGraphCode
      : activeFramework === "crewai"
      ? crewAiCode
      : activeFramework === "rust"
      ? rustCode
      : pythonAsyncCode;

  return (
    <section className="grok-swarm-panel">
      <div className="section-header-block">
        <h2 className="section-title">🤖 xAI Grok & Multi-Agent Swarm Orchestration</h2>
        <p className="section-subtitle">
          Autonomous Agent-to-Agent (A2A) consultation patterns and ready-to-run configurations for xAI Grok, LangGraph, CrewAI, Rust Alloy, and Async Python.
        </p>
      </div>

      <div className="tab-container">
        <div className="tab-buttons">
          <button
            type="button"
            className={`tab-btn ${activeFramework === "grok" ? "active" : ""}`}
            onClick={() => setActiveFramework("grok")}
          >
            🧠 xAI Grok Tool
          </button>
          <button
            type="button"
            className={`tab-btn ${activeFramework === "langgraph" ? "active" : ""}`}
            onClick={() => setActiveFramework("langgraph")}
          >
            🕸️ LangGraph State Machine
          </button>
          <button
            type="button"
            className={`tab-btn ${activeFramework === "crewai" ? "active" : ""}`}
            onClick={() => setActiveFramework("crewai")}
          >
            👥 CrewAI Autonomous Swarm
          </button>
          <button
            type="button"
            className={`tab-btn ${activeFramework === "rust" ? "active" : ""}`}
            onClick={() => setActiveFramework("rust")}
          >
            🦀 Rust (Alloy + Reqwest)
          </button>
          <button
            type="button"
            className={`tab-btn ${activeFramework === "python_async" ? "active" : ""}`}
            onClick={() => setActiveFramework("python_async")}
          >
            ⚡ Python Async (httpx)
          </button>
        </div>

        <div className="tab-content">
          <div className="code-box-wrap">
            <div className="code-box-header">
              <span>
                {activeFramework === "grok" && "xAI Grok Function-Calling Definition"}
                {activeFramework === "langgraph" && "LangGraph Stateful 402 Execution Graph"}
                {activeFramework === "crewai" && "CrewAI Autonomous Agent Tool"}
                {activeFramework === "rust" && "Rust High-Performance Client (Alloy)"}
                {activeFramework === "python_async" && "Async Python High-Concurrency Client"}
              </span>
              <CopyButton text={currentSnippet} label="Copy Implementation" />
            </div>
            <pre className="code-block"><code>{currentSnippet}</code></pre>
          </div>
        </div>
      </div>
    </section>
  );
}
