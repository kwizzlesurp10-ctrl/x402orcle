"use client";

import { useState } from "react";
import { CopyButton } from "./CopyButton";

export function MultiRuntimeSdk({ publicBaseUrl }: { publicBaseUrl: string }) {
  const [activeLang, setActiveLang] = useState<"curl" | "ts" | "python" | "go" | "langchain">("curl");

  const baseUrl = publicBaseUrl.replace(/\/$/, "");

  const curlCode = `# 1. Unpaid probe receives HTTP 402 + PAYMENT-REQUIRED base64 header
curl -X POST ${baseUrl}/api/consult/oracle_ask \\
  -H "content-type: application/json" \\
  -d '{"question": "Why is my Bazaar listing unranked?", "audience": "agent"}'

# 2. Resend with EIP-712 payment signature ($SIG) header to receive 200 OK Wisdom Envelope
curl -X POST ${baseUrl}/api/consult/oracle_ask \\
  -H "content-type: application/json" \\
  -H "PAYMENT-SIGNATURE: <BASE64_PAYMENT_SIGNATURE>" \\
  -d '{"question": "Why is my Bazaar listing unranked?", "audience": "agent"}'`;

  const tsCode = `import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";

async function consultOracle() {
  const endpoint = "${baseUrl}/api/consult/oracle_ask";
  const body = { question: "Why is my Bazaar listing unranked?", audience: "agent" };

  // Step 1: Probe endpoint for HTTP 402 challenge
  const res402 = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res402.status === 402) {
    const prB64 = res402.headers.get("PAYMENT-REQUIRED");
    const challenge = JSON.parse(Buffer.from(prB64!, "base64").toString());
    const accept = challenge.accepts[0];

    // Step 2: Sign EIP-712 TransferWithAuthorization (USDC on Base)
    const walletClient = createWalletClient({ chain: base, transport: custom(window.ethereum) });
    const [account] = await walletClient.getAddresses();

    const signature = await walletClient.signTypedData({
      account: account!,
      domain: {
        name: "USD Coin",
        version: "2",
        chainId: 8453,
        verifyingContract: accept.asset,
      },
      types: {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "TransferWithAuthorization",
      message: {
        from: account!,
        to: accept.payTo,
        value: BigInt(accept.amount),
        validAfter: 0n,
        validBefore: BigInt(Math.floor(Date.now() / 1000) + 3600),
        nonce: \`0x\${Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("")}\`,
      },
    });

    const paymentPayload = {
      x402Version: 2,
      accepted: accept,
      payload: { signature, authorization: { from: account, to: accept.payTo, value: accept.amount } }
    };
    const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");

    // Step 3: Resend request with PAYMENT-SIGNATURE
    const res200 = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "PAYMENT-SIGNATURE": paymentHeader,
      },
      body: JSON.stringify(body),
    });

    const wisdomEnvelope = await res200.json();
    console.log("Verdict:", wisdomEnvelope.verdict);
    console.log("Wisdom:", wisdomEnvelope.wisdom);
  }
}
consultOracle();`;

  const pythonCode = `import json, base64, time, requests
from eth_account import Account
from eth_account.messages import encode_typed_data

def consult_oracle(private_key_hex, question):
    url = "${baseUrl}/api/consult/oracle_ask"
    account = Account.from_key(private_key_hex)
    payload = {"question": question, "audience": "agent"}

    # 1. Unpaid Probe
    r = requests.post(url, json=payload)
    if r.status_code == 402:
        pr_b64 = r.headers.get("PAYMENT-REQUIRED")
        challenge = json.loads(base64.b64decode(pr_b64).decode())
        accept = challenge["accepts"][0]

        # 2. Construct EIP-712 Structured Data
        domain_data = {
            "name": "USD Coin",
            "version": "2",
            "chainId": 8453,
            "verifyingContract": accept["asset"]
        }
        types = {
            "TransferWithAuthorization": [
                {"name": "from", "type": "address"},
                {"name": "to", "type": "address"},
                {"name": "value", "type": "uint256"},
                {"name": "validAfter", "type": "uint256"},
                {"name": "validBefore", "type": "uint256"},
                {"name": "nonce", "type": "bytes32"}
            ]
        }
        message = {
            "from": account.address,
            "to": accept["payTo"],
            "value": int(accept["amount"]),
            "validAfter": 0,
            "validBefore": int(time.time()) + 3600,
            "nonce": "0x" + "00"*32
        }

        signable = encode_typed_data(domain_data, types, message)
        signed = account.sign_message(signable)

        payment_sig = base64.b64encode(json.dumps({
            "x402Version": 2,
            "accepted": accept,
            "payload": {"signature": signed.signature.hex(), "authorization": message}
        }).encode()).decode()

        # 3. Resend with Signature
        res200 = requests.post(url, json=payload, headers={"PAYMENT-SIGNATURE": payment_sig})
        return res200.json()

print(consult_oracle("0x...", "Why is my Bazaar listing unranked?"))`;

  const goCode = `package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func main() {
	url := "${baseUrl}/api/consult/oracle_ask"
	body, _ := json.Marshal(map[string]string{"question": "Why is my Bazaar listing unranked?"})

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 402 {
		prHeader := resp.Header.Get("PAYMENT-REQUIRED")
		decoded, _ := base64.StdEncoding.DecodeString(prHeader)
		fmt.Printf("Received 402 Payment Required:\\n%s\\n", string(decoded))
	}
}`;

  const langchainCode = `import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const oracleAskTool = new DynamicStructuredTool({
  name: "oracle_ask",
  description: "Consult x402 Oracle for smart contract attestation & 402 diagnostics on Base USDC",
  schema: z.object({
    question: z.string().describe("The technical question or diagnostic task for the Oracle"),
  }),
  func: async ({ question }) => {
    const res = await fetch("${baseUrl}/api/consult/oracle_ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
    });
    return await res.json();
  },
});`;

  const currentSnippet =
    activeLang === "curl"
      ? curlCode
      : activeLang === "ts"
      ? tsCode
      : activeLang === "python"
      ? pythonCode
      : activeLang === "go"
      ? goCode
      : langchainCode;

  return (
    <section className="multi-sdk-panel">
      <div className="section-header-block">
        <h2 className="section-title">💻 Multi-Runtime SDK Code Examples</h2>
        <p className="section-subtitle">
          Integration code blocks across major developer runtimes and AI frameworks.
        </p>
      </div>

      <div className="tab-container">
        <div className="tab-buttons">
          <button
            type="button"
            className={`tab-btn ${activeLang === "curl" ? "active" : ""}`}
            onClick={() => setActiveLang("curl")}
          >
            🐚 cURL (Bash)
          </button>
          <button
            type="button"
            className={`tab-btn ${activeLang === "ts" ? "active" : ""}`}
            onClick={() => setActiveLang("ts")}
          >
            🟦 Node.js / TS (Viem)
          </button>
          <button
            type="button"
            className={`tab-btn ${activeLang === "python" ? "active" : ""}`}
            onClick={() => setActiveLang("python")}
          >
            🐍 Python (eth_account)
          </button>
          <button
            type="button"
            className={`tab-btn ${activeLang === "go" ? "active" : ""}`}
            onClick={() => setActiveLang("go")}
          >
            🐹 Go
          </button>
          <button
            type="button"
            className={`tab-btn ${activeLang === "langchain" ? "active" : ""}`}
            onClick={() => setActiveLang("langchain")}
          >
            🦜🔗 LangChain / Vercel AI SDK
          </button>
        </div>

        <div className="tab-content">
          <div className="code-box-wrap">
            <div className="code-box-header">
              <span>
                {activeLang === "curl" && "bash curl"}
                {activeLang === "ts" && "TypeScript / Node.js"}
                {activeLang === "python" && "Python 3"}
                {activeLang === "go" && "Go main.go"}
                {activeLang === "langchain" && "LangChain / Vercel AI SDK Tool"}
              </span>
              <CopyButton text={currentSnippet} label="Copy Code" />
            </div>
            <pre className="code-block"><code>{currentSnippet}</code></pre>
          </div>
        </div>
      </div>
    </section>
  );
}
