"use client";

import { CopyButton } from "./CopyButton";

export function CryptoDocs() {
  const eip712Domain = {
    name: "USD Coin",
    version: "2",
    chainId: 8453,
    verifyingContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  };

  const eip712Types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const envelopeSchema = {
    x402Version: 2,
    accepted: {
      scheme: "exact",
      network: "eip155:8453",
      amount: "100000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
    },
    payload: {
      signature: "0x3a4f...e1c9 (65-byte secp256k1 ECDSA signature)",
      authorization: {
        from: "0xPayerWalletAddress",
        to: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
        value: "100000",
        validAfter: "0",
        validBefore: "1770000000",
        nonce: "0x9c2d...81f0 (32-byte cryptographically secure random nonce)",
      },
    },
  };

  return (
    <section className="crypto-docs-panel">
      <div className="section-header-block">
        <h2 className="section-title">🔐 Cryptographic Specification ($SIG Generation & EIP-712)</h2>
        <p className="section-subtitle">
          Detailed cryptographic handshake layout, EIP-712 structured data signing parameters, envelope schemas, and header construction for Base USDC micro-settlements.
        </p>
      </div>

      <div className="spec-grid">
        {/* Box 1: EIP-712 Domain & Type Specification */}
        <div className="spec-card">
          <div className="spec-card-header">
            <h3>1. EIP-712 Domain & EIP-3009 Transfer Types</h3>
            <CopyButton text={JSON.stringify({ domain: eip712Domain, types: eip712Types }, null, 2)} label="Copy Spec" />
          </div>
          <p className="spec-desc">
            Signatures authorize gasless USDC transfers on Base via EIP-3009 <code>TransferWithAuthorization</code> without granting allowance to an intermediary contract.
          </p>

          <div className="code-box-header">
            <span>EIP-712 Domain Parameters (Base Mainnet)</span>
          </div>
          <pre className="code-block"><code>{JSON.stringify(eip712Domain, null, 2)}</code></pre>

          <div className="code-box-header margin-top-sm">
            <span>TransferWithAuthorization Struct Fields</span>
          </div>
          <pre className="code-block"><code>{JSON.stringify(eip712Types, null, 2)}</code></pre>
        </div>

        {/* Box 2: Payment Envelope Payload Structure */}
        <div className="spec-card">
          <div className="spec-card-header">
            <h3>2. EIP-712 Outer Envelope & Base64 Header Encoding</h3>
            <CopyButton text={JSON.stringify(envelopeSchema, null, 2)} label="Copy Envelope" />
          </div>
          <p className="spec-desc">
            The generated signature and message parameters are wrapped into an <code>x402Version: 2</code> JSON payload, base64-encoded, and attached via the <code>PAYMENT-SIGNATURE</code> HTTP header.
          </p>

          <div className="code-box-header">
            <span>Canonical Payment Signature Envelope Schema</span>
          </div>
          <pre className="code-block"><code>{JSON.stringify(envelopeSchema, null, 2)}</code></pre>

          <div className="header-flow-box margin-top-sm">
            <span className="flow-title">HTTP Header Attachment:</span>
            <code className="flow-code">PAYMENT-SIGNATURE: {btoa(JSON.stringify(envelopeSchema)).slice(0, 48)}...</code>
          </div>
        </div>
      </div>

      {/* Step by Step Flow */}
      <div className="flow-steps-card margin-top">
        <h3>3. End-to-End Cryptographic Handshake Sequence</h3>
        <ol className="steps-list">
          <li>
            <strong>Challenge Discovery (HTTP 402)</strong>: Client sends POST request to a paid endpoint (e.g. <code>/api/consult/oracle_ask</code>). Server returns <code>402 Payment Required</code> with a <code>PAYMENT-REQUIRED</code> base64 header containing exact requirements (amount in 6-decimal atomic units, verifying contract, payTo receiver address).
          </li>
          <li>
            <strong>Domain & Struct Assembly</strong>: Client parses <code>accepts[0]</code>, constructs the EIP-712 domain (Base chainId 8453, USDC contract <code>0x8335...02913</code>) and message parameters including a unique 32-byte <code>nonce</code> and expiry timestamp (<code>validBefore</code>).
          </li>
          <li>
            <strong>Wallet Signing ($SIG)</strong>: Client calls <code>eth_signTypedData_v4</code> on their Base wallet. The wallet prompts the user/agent with a clear, safe EIP-712 transfer prompt showing exact USDC value and receiver address.
          </li>
          <li>
            <strong>Envelope Formatting & Settlement</strong>: Client constructs the final <code>x402Version: 2</code> envelope JSON, base64-encodes it into the <code>PAYMENT-SIGNATURE</code> header, and retries the HTTP request. Server verifies signature via CDP facilitator and returns HTTP 200 with the completed Wisdom Envelope and receipt.
          </li>
        </ol>
      </div>
    </section>
  );
}
