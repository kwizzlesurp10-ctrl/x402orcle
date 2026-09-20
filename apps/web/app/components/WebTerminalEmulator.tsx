"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { validatePaymentEnvelope } from "@x402orcle/oracle-brain/validator";
import { CopyButton } from "./CopyButton";

type TerminalEntry = {
  command: string;
  output: ReactNode;
  timestamp: string;
};

export function WebTerminalEmulator({
  payTo,
  network,
}: {
  payTo: string;
  network: string;
}) {
  const [inputVal, setInputVal] = useState<string>("");
  const [history, setHistory] = useState<TerminalEntry[]>([
    {
      command: "oracle --version",
      output: "x402 Oracle CLI v0.1.0 · Base Mainnet (eip155:8453) · Protocol v2 · Type 'help' for commands.",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [cmdHistory, setCmdHistory] = useState<string[]>(["oracle --version"]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inputVal.trim();
    if (!raw) return;

    setCmdHistory((prev) => [...prev, raw]);
    setHistoryIdx(-1);
    setInputVal("");

    const timestamp = new Date().toLocaleTimeString();
    const parts = raw.split(" ");
    const cmd = parts[0]?.toLowerCase();
    const sub = parts[1]?.toLowerCase();

    if (cmd === "clear" || raw === "cls") {
      setHistory([]);
      return;
    }

    if (cmd === "help") {
      setHistory((prev) => [
        ...prev,
        {
          command: raw,
          output: (
            <div className="term-help-output">
              <div className="term-line highlight-cyan">AVAILABLE COMMANDS:</div>
              <div>  <strong>health</strong>                   — Check live operational status & RPC latency</div>
              <div>  <strong>pricing</strong>                  — View complete free & paid capability menu</div>
              <div>  <strong>probe &lt;tool_name&gt;</strong>          — Send unpaid probe to inspect 402 challenge header</div>
              <div>  <strong>validate &lt;signature_json&gt;</strong> — Cryptographically verify EIP-712 envelope</div>
              <div>  <strong>manifests</strong>                — List all machine discovery endpoints & URLs</div>
              <div>  <strong>clear</strong>                    — Clear terminal screen</div>
            </div>
          ),
          timestamp,
        },
      ]);
      return;
    }

    if (cmd === "health") {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        setHistory((prev) => [
          ...prev,
          {
            command: raw,
            output: (
              <pre className="term-json-output">
                <code>{JSON.stringify(data, null, 2)}</code>
              </pre>
            ),
            timestamp,
          },
        ]);
      } catch (err: unknown) {
        setHistory((prev) => [
          ...prev,
          {
            command: raw,
            output: `Error fetching health: ${err instanceof Error ? err.message : "Unknown error"}`,
            timestamp,
          },
        ]);
      }
      return;
    }

    if (cmd === "pricing") {
      try {
        const res = await fetch("/api/pricing");
        const data = await res.json();
        setHistory((prev) => [
          ...prev,
          {
            command: raw,
            output: (
              <pre className="term-json-output">
                <code>{JSON.stringify(data, null, 2)}</code>
              </pre>
            ),
            timestamp,
          },
        ]);
      } catch (err: unknown) {
        setHistory((prev) => [
          ...prev,
          {
            command: raw,
            output: `Error fetching pricing: ${err instanceof Error ? err.message : "Unknown error"}`,
            timestamp,
          },
        ]);
      }
      return;
    }

    if (cmd === "probe") {
      const toolName = sub || "oracle_ask";
      try {
        const res = await fetch(`/api/consult/${toolName}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: "Ping from web CLI emulator", audience: "agent" }),
        });
        const pr = res.headers.get("PAYMENT-REQUIRED");
        const wwwAuth = res.headers.get("WWW-Authenticate");
        const body = await res.json();
        setHistory((prev) => [
          ...prev,
          {
            command: raw,
            output: (
              <div className="term-probe-output">
                <div className="term-line highlight-amber">HTTP {res.status} PAYMENT REQUIRED</div>
                <div><strong>WWW-Authenticate:</strong> {wwwAuth || "x402 scheme=\"exact\""}</div>
                <div><strong>PAYMENT-REQUIRED (Base64):</strong> {pr ? `${pr.slice(0, 48)}...` : "None"}</div>
                <pre className="term-json-output"><code>{JSON.stringify(body, null, 2)}</code></pre>
              </div>
            ),
            timestamp,
          },
        ]);
      } catch (err: unknown) {
        setHistory((prev) => [
          ...prev,
          {
            command: raw,
            output: `Probe failed: ${err instanceof Error ? err.message : "Unknown error"}`,
            timestamp,
          },
        ]);
      }
      return;
    }

    if (cmd === "manifests") {
      setHistory((prev) => [
        ...prev,
        {
          command: raw,
          output: (
            <div className="term-manifests-output">
              <div>- Catalog:           /.well-known/x402</div>
              <div>- Agent Card:        /.well-known/agent-card.json</div>
              <div>- MCP Server:        /.well-known/mcp.json</div>
              <div>- Funding:           /.well-known/funding.json</div>
              <div>- OpenAPI 3.1:       /openapi.json</div>
              <div>- LLMs Txt:          /llms.txt</div>
              <div>- Hosted Docs:       /docs</div>
            </div>
          ),
          timestamp,
        },
      ]);
      return;
    }

    if (cmd === "validate") {
      const sigPayload = raw.replace(/^validate\s*/i, "");
      const res = validatePaymentEnvelope(sigPayload || "{}", payTo, network);
      setHistory((prev) => [
        ...prev,
        {
          command: raw,
          output: (
            <div className="term-val-output">
              <div className={`term-line ${res.isValid ? "highlight-green" : "highlight-warn"}`}>
                VALIDATION SCORE: {res.score}% — {res.isValid ? "AIRTIGHT" : "FAILED"}
              </div>
              {res.checks.map((c, i) => (
                <div key={i}>[{c.passed ? "PASS" : "FAIL"}] {c.name}: {c.detail}</div>
              ))}
            </div>
          ),
          timestamp,
        },
      ]);
      return;
    }

    setHistory((prev) => [
      ...prev,
      {
        command: raw,
        output: `Command not found: ${raw}. Type 'help' for available commands.`,
        timestamp,
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const nextIdx = historyIdx < cmdHistory.length - 1 ? historyIdx + 1 : historyIdx;
        setHistoryIdx(nextIdx);
        setInputVal(cmdHistory[cmdHistory.length - 1 - nextIdx] || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setInputVal(cmdHistory[cmdHistory.length - 1 - nextIdx] || "");
      } else if (historyIdx === 0) {
        setHistoryIdx(-1);
        setInputVal("");
      }
    }
  };

  return (
    <section className="terminal-emulator-panel">
      <div className="section-header-block">
        <h2 className="section-title">💻 Interactive Command-Line Console (Web CLI)</h2>
        <p className="section-subtitle">
          Direct terminal interface into the live Oracle node. Run commands, query health, simulate 402 handshakes, and inspect signatures.
        </p>
      </div>

      <div className="terminal-window">
        <div className="terminal-titlebar">
          <div className="window-dots">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
          </div>
          <div className="terminal-title">x402-oracle-cli — bash — 80x24</div>
          <div className="terminal-quick-links">
            <button type="button" className="btn-term-pill" onClick={() => setInputVal("health")}>health</button>
            <button type="button" className="btn-term-pill" onClick={() => setInputVal("pricing")}>pricing</button>
            <button type="button" className="btn-term-pill" onClick={() => setInputVal("probe oracle_ask")}>probe oracle_ask</button>
            <button type="button" className="btn-term-pill" onClick={() => setInputVal("help")}>help</button>
          </div>
        </div>

        <div className="terminal-screen">
          {history.map((entry, idx) => (
            <div key={idx} className="terminal-entry">
              <div className="terminal-prompt-line">
                <span className="term-user">agent@x402-node</span>
                <span className="term-colon">:</span>
                <span className="term-path">~</span>
                <span className="term-dollar">$</span>
                <span className="term-cmd-text">{entry.command}</span>
                <span className="term-time">{entry.timestamp}</span>
              </div>
              <div className="terminal-response">{entry.output}</div>
            </div>
          ))}

          <form onSubmit={handleCommandSubmit} className="terminal-input-form">
            <span className="term-user">agent@x402-node</span>
            <span className="term-colon">:</span>
            <span className="term-path">~</span>
            <span className="term-dollar">$</span>
            <input
              type="text"
              className="terminal-input"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type 'help', 'health', 'probe oracle_ask'..."
              autoCapitalize="none"
              autoComplete="off"
              spellCheck="false"
            />
          </form>
          <div ref={terminalEndRef} />
        </div>
      </div>
    </section>
  );
}
