"use client";

import { useState } from "react";
import { CopyButton } from "./CopyButton";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

type ToolKey =
  | "oracle_ask"
  | "oracle_diagnose_402"
  | "oracle_review_mcp"
  | "oracle_bazaar_rewrite"
  | "complete_oracle_task";

const SAMPLE_INPUTS: Record<ToolKey, Record<string, unknown>> = {
  oracle_ask: {
    question: "Why is my Bazaar listing unranked after 402s with no settlement?",
    audience: "agent",
  },
  oracle_diagnose_402: {
    challenge_b64_or_json: "eyJ4NDAyVmVyc2lvbiI6Mn0=",
    resource_url: "https://example.com/paid",
  },
  oracle_review_mcp: {
    mcp_url: "https://example.com/mcp",
    notes: "streamable-http, two paid tools",
  },
  oracle_bazaar_rewrite: {
    current_description: "API for data",
    buyer_phrases: ["x402 mcp oracle", "paid mcp bazaar"],
  },
  complete_oracle_task: {
    goal: "List oracle_ask on CDP Bazaar after first mainnet settle",
    constraints: "seller-only host, no EVM_PRIVATE_KEY",
  },
};

export function Sandbox() {
  const [selectedTool, setSelectedTool] = useState<ToolKey>("oracle_ask");
  const [inputJson, setInputJson] = useState<string>(
    JSON.stringify(SAMPLE_INPUTS.oracle_ask, null, 2)
  );
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [useDemoWallet, setUseDemoWallet] = useState<boolean>(true);
  const [step, setStep] = useState<"idle" | "probe_sent" | "signed" | "done">("idle");
  const [loading, setLoading] = useState<boolean>(false);

  const [response402, setResponse402] = useState<Record<string, unknown> | null>(null);
  const [decodedChallenge, setDecodedChallenge] = useState<Record<string, unknown> | null>(null);
  const [paymentSignature, setPaymentSignature] = useState<string | null>(null);
  const [response200, setResponse200] = useState<Record<string, unknown> | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleToolChange = (tool: ToolKey) => {
    setSelectedTool(tool);
    setInputJson(JSON.stringify(SAMPLE_INPUTS[tool], null, 2));
    setStep("idle");
    setResponse402(null);
    setDecodedChallenge(null);
    setPaymentSignature(null);
    setResponse200(null);
    setErrorMessage(null);
  };

  const connectWallet = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = (await window.ethereum.request({
          method: "eth_requestAccounts",
        })) as string[];
        if (accounts && accounts[0]) {
          setWalletAddress(accounts[0]);
          setUseDemoWallet(false);
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to connect wallet"
        );
      }
    } else {
      setErrorMessage("No browser wallet (e.g. Coinbase Wallet / MetaMask) found. Operating in Demo Wallet mode.");
    }
  };

  const runInitialProbe = async () => {
    setLoading(true);
    setErrorMessage(null);
    setResponse402(null);
    setDecodedChallenge(null);
    setPaymentSignature(null);
    setResponse200(null);

    let parsedBody = {};
    try {
      parsedBody = JSON.parse(inputJson);
    } catch {
      setErrorMessage("Invalid JSON input format");
      setLoading(false);
      return;
    }

    const start = performance.now();
    try {
      const res = await fetch(`/api/consult/${selectedTool}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsedBody),
      });

      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);

      const prHeader = res.headers.get("PAYMENT-REQUIRED") || res.headers.get("payment-required");
      const body = await res.json();

      setResponse402({
        status: res.status,
        headers: {
          "PAYMENT-REQUIRED": prHeader ? `${prHeader.slice(0, 32)}...` : null,
          "WWW-Authenticate": res.headers.get("WWW-Authenticate"),
        },
        body,
      });

      if (prHeader) {
        try {
          const decoded = JSON.parse(atob(prHeader));
          setDecodedChallenge(decoded);
        } catch {
          setDecodedChallenge(body);
        }
      } else {
        setDecodedChallenge(body);
      }

      setStep("probe_sent");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to send initial probe");
    } finally {
      setLoading(false);
    }
  };

  const signPaymentPayload = async () => {
    setLoading(true);
    setErrorMessage(null);

    if (!decodedChallenge) {
      setErrorMessage("No challenge decoded. Run initial probe first.");
      setLoading(false);
      return;
    }

    const accepts = (decodedChallenge as { accepts?: Record<string, unknown>[] }).accepts?.[0] || {};
    const amount = String(accepts.amount || "100000");
    const payTo = String(accepts.payTo || "0xAB745e5F576667037696e78ba7dA28E193E4423D");
    const network = String(accepts.network || "eip155:8453");
    const payer = walletAddress || "0xdemo000000000000000000000000000000000001";

    if (!useDemoWallet && walletAddress && typeof window !== "undefined" && window.ethereum) {
      try {
        const domain = {
          name: "USD Coin",
          version: "2",
          chainId: network.includes("84532") ? 84532 : 8453,
          verifyingContract: network.includes("84532")
            ? "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
            : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        };
        const types = {
          TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        };
        const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")}`;
        const validBefore = String(Math.floor(Date.now() / 1000) + 3600);
        const value = {
          from: payer,
          to: payTo,
          value: amount,
          validAfter: "0",
          validBefore,
          nonce,
        };

        const signature = (await window.ethereum.request({
          method: "eth_signTypedData_v4",
          params: [payer, JSON.stringify({ types, domain, primaryType: "TransferWithAuthorization", message: value })],
        })) as string;

        const payloadObj = {
          x402Version: 2,
          accepted: accepts,
          payload: {
            signature,
            authorization: value,
          },
        };

        const encodedSig = btoa(JSON.stringify(payloadObj));
        setPaymentSignature(encodedSig);
        setStep("signed");
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error
            ? `Wallet signing failed: ${err.message}. Switching to demo signature mode.`
            : "Wallet signature rejected."
        );
        // Fallback to demo signature format
        generateDemoSignature(accepts, payer);
      } finally {
        setLoading(false);
      }
    } else {
      generateDemoSignature(accepts, payer);
      setLoading(false);
    }
  };

  const generateDemoSignature = (accepts: Record<string, unknown>, payer: string) => {
    const demoPayload = {
      x402Version: 2,
      accepted: accepts,
      payload: {
        signature: `0xdemo${Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")}`,
        authorization: {
          from: payer,
          to: String(accepts.payTo || "0xAB745e5F576667037696e78ba7dA28E193E4423D"),
          value: String(accepts.amount || "100000"),
          validAfter: "0",
          validBefore: String(Math.floor(Date.now() / 1000) + 3600),
          nonce: `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")}`,
        },
      },
    };
    const encodedSig = btoa(JSON.stringify(demoPayload));
    setPaymentSignature(encodedSig);
    setStep("signed");
  };

  const executePaymentSettle = async () => {
    setLoading(true);
    setErrorMessage(null);

    if (!paymentSignature) {
      setErrorMessage("No payment signature generated.");
      setLoading(false);
      return;
    }

    let parsedBody = {};
    try {
      parsedBody = JSON.parse(inputJson);
    } catch {
      setErrorMessage("Invalid JSON input format");
      setLoading(false);
      return;
    }

    const start = performance.now();
    try {
      const res = await fetch(`/api/consult/${selectedTool}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "PAYMENT-SIGNATURE": paymentSignature,
        },
        body: JSON.stringify(parsedBody),
      });

      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);

      const body = await res.json();
      setResponse200({
        status: res.status,
        headers: {
          "PAYMENT-RESPONSE": res.headers.get("PAYMENT-RESPONSE") || "settled",
        },
        body,
      });

      if (res.ok) {
        setStep("done");
      } else {
        setErrorMessage(`Server returned HTTP ${res.status}: ${JSON.stringify(body)}`);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to execute 200 consult");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="sandbox-panel">
      <div className="sandbox-header">
        <div>
          <h2 className="section-title">⚡ Interactive x402 Payment Sandbox</h2>
          <p className="section-subtitle">
            Execute full HTTP 402 Payment Required → EIP-712 Sign → 200 OK Wisdom Consult cycles.
          </p>
        </div>
        <div className="wallet-controls">
          {walletAddress ? (
            <div className="wallet-pill connected">
              <span className="wallet-dot" />
              <span>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
              <button
                type="button"
                className="btn-text"
                onClick={() => {
                  setWalletAddress(null);
                  setUseDemoWallet(true);
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="wallet-pill-group">
              <button type="button" className="btn-secondary btn-sm" onClick={connectWallet}>
                🔗 Connect Wallet (Base)
              </button>
              <button
                type="button"
                className={`btn-sm ${useDemoWallet ? "btn-active" : "btn-secondary"}`}
                onClick={() => setUseDemoWallet(true)}
              >
                🧪 Demo Signer
              </button>
            </div>
          )}
        </div>
      </div>

      {errorMessage && <div className="error-banner">⚠️ {errorMessage}</div>}

      <div className="sandbox-grid">
        {/* Left Column: Tool Selector & Request Input */}
        <div className="sandbox-col">
          <label htmlFor="tool-select-dropdown" className="field-label">1. Select Oracle Endpoint Capability</label>
          <select
            id="tool-select-dropdown"
            className="input-select"
            value={selectedTool}
            onChange={(e) => handleToolChange(e.target.value as ToolKey)}
          >
            <option value="oracle_ask">oracle_ask ($0.10 USDC) · Wisdom envelope</option>
            <option value="oracle_diagnose_402">oracle_diagnose_402 ($0.50 USDC) · Post-mortem 402 handshake</option>
            <option value="oracle_review_mcp">oracle_review_mcp ($3.00 USDC) · MCP server review</option>
            <option value="oracle_bazaar_rewrite">oracle_bazaar_rewrite ($1.50 USDC) · Bazaar ranking rewrite</option>
            <option value="complete_oracle_task">complete_oracle_task ($10.00 USDC) · A2A Outcome Task</option>
          </select>

          <div className="field-header">
            <label htmlFor="input-json-area" className="field-label">2. Request Body (JSON)</label>
            <button
              type="button"
              className="btn-text"
              onClick={() => setInputJson(JSON.stringify(SAMPLE_INPUTS[selectedTool], null, 2))}
            >
              Reset Example
            </button>
          </div>
          <textarea
            id="input-json-area"
            className="input-textarea"
            rows={7}
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
          />

          <div className="sandbox-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={loading}
              onClick={runInitialProbe}
            >
              {loading && step === "idle" ? "Sending..." : "1️⃣ Send Unpaid Probe (Expect 402)"}
            </button>

            {step !== "idle" && (
              <button
                type="button"
                className="btn-accent"
                disabled={loading || !decodedChallenge}
                onClick={signPaymentPayload}
              >
                {loading && step === "probe_sent" ? "Signing..." : "2️⃣ Sign $SIG (EIP-712)"}
              </button>
            )}

            {paymentSignature && (
              <button
                type="button"
                className="btn-success"
                disabled={loading}
                onClick={executePaymentSettle}
              >
                {loading && step === "signed" ? "Settling..." : "3️⃣ Execute 200 Consult"}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Cycle Step Results */}
        <div className="sandbox-col">
          <div className="step-tabs">
            <span className={`step-tab ${step === "idle" ? "active" : ""}`}>1. Unpaid 402</span>
            <span className={`step-tab ${step === "probe_sent" || step === "signed" ? "active" : ""}`}>2. EIP-712 $SIG</span>
            <span className={`step-tab ${step === "done" ? "active" : ""}`}>3. 200 Wisdom</span>
          </div>

          {/* 402 Challenge Card */}
          {response402 ? (
            <div className="result-card">
              <div className="result-card-header">
                <span className="badge badge-amber">HTTP 402 PAYMENT REQUIRED</span>
                {latencyMs !== null && <span className="latency-tag">{latencyMs}ms</span>}
              </div>

              {decodedChallenge && (
                <div className="decoded-challenge">
                  <div className="challenge-meta">
                    <div><span className="label">Amount:</span> <strong className="accent">{String((decodedChallenge.accepts as Record<string, unknown>[])?.[0]?.amount || "100000")} atomic (0.10 USDC)</strong></div>
                    <div><span className="label">Pay To:</span> <code className="code-inline">{String((decodedChallenge.accepts as Record<string, unknown>[])?.[0]?.payTo || "")}</code></div>
                    <div><span className="label">Network:</span> <code>{String((decodedChallenge.accepts as Record<string, unknown>[])?.[0]?.network || "")}</code></div>
                  </div>
                </div>
              )}

              <div className="code-box-wrap">
                <div className="code-box-header">
                  <span>Decoded 402 Challenge Payload</span>
                  <CopyButton text={JSON.stringify(decodedChallenge, null, 2)} label="Copy JSON" />
                </div>
                <pre className="code-block"><code>{JSON.stringify(decodedChallenge || response402, null, 2)}</code></pre>
              </div>
            </div>
          ) : (
            <div className="placeholder-box">
              <p>Click <strong>"1️⃣ Send Unpaid Probe"</strong> to trigger the initial HTTP 402 Payment Required response.</p>
            </div>
          )}

          {/* Signature Card */}
          {paymentSignature && (
            <div className="result-card margin-top">
              <div className="result-card-header">
                <span className="badge badge-cyan">EIP-712 PAYMENT-SIGNATURE GENERATED</span>
              </div>
              <div className="code-box-wrap">
                <div className="code-box-header">
                  <span>Header: PAYMENT-SIGNATURE (Base64)</span>
                  <CopyButton text={paymentSignature} label="Copy Signature" />
                </div>
                <pre className="code-block"><code>{paymentSignature}</code></pre>
              </div>
            </div>
          )}

          {/* 200 OK Wisdom Envelope Output Card */}
          {response200 && (
            <div className="result-card margin-top success-glow">
              <div className="result-card-header">
                <span className="badge badge-green">HTTP 200 OK — WISDOM ENVELOPE</span>
                {latencyMs !== null && <span className="latency-tag">{latencyMs}ms</span>}
              </div>
              <div className="code-box-wrap">
                <div className="code-box-header">
                  <span>Wisdom Envelope Response</span>
                  <CopyButton text={JSON.stringify(response200.body, null, 2)} label="Copy Result" />
                </div>
                <pre className="code-block"><code>{JSON.stringify(response200.body, null, 2)}</code></pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
